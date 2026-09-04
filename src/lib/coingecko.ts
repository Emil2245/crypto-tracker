import type { CoinSearchResult } from "@/types";

const BASE = "https://api.coingecko.com/api/v3";

// Real serial queue for CoinGecko — Promise.all() would otherwise race past
// the throttle and trigger 429s (breaking the chart the moment there are 2+
// holdings). Every request chains onto the previous, guaranteed sequential.
const MIN_INTERVAL = 1500;
let queue: Promise<unknown> = Promise.resolve();
let lastRequestTime = 0;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_INTERVAL) {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL - elapsed));
    }
    lastRequestTime = Date.now();
    return fn();
  });
  // Prevent one caller's failure from breaking the queue for the next.
  queue = run.catch(() => {});
  return run;
}

async function throttledFetch(url: string): Promise<Response> {
  return enqueue(async () => {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000));
      lastRequestTime = Date.now();
      return fetch(url);
    }
    return res;
  });
}

export async function searchCoins(
  query: string
): Promise<CoinSearchResult[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await throttledFetch(
      `${BASE}/search?query=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.coins || []).slice(0, 20).map(
      (c: { id: string; name: string; symbol: string; thumb: string; large: string }) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        thumb: c.thumb,
        large: c.large,
      })
    );
  } catch {
    return [];
  }
}

export async function getPrices(
  coinIds: string[]
): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {};
  try {
    const ids = coinIds.join(",");
    const res = await throttledFetch(
      `${BASE}/simple/price?ids=${ids}&vs_currencies=usd`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, number> = {};
    for (const id of coinIds) {
      if (data[id]?.usd !== undefined) {
        result[id] = data[id].usd;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Fetches USD prices for the given coins, cascading through CoinGecko simple
 * price → CryptoCompare pricemulti for anything CoinGecko didn't return.
 * `symbolsByCoin` maps a coinId to its ticker symbol (e.g. "bitcoin" → "BTC")
 * so the CryptoCompare fallback can address the same coin.
 */
export async function getPricesWithFallback(
  coinIds: string[],
  symbolsByCoin: Record<string, string>
): Promise<Record<string, number>> {
  const primary = await getPrices(coinIds);
  const missing = coinIds.filter((id) => !(id in primary));
  if (missing.length === 0) return primary;

  const symbolMissing = [
    ...new Set(
      missing
        .map((id) => symbolsByCoin[id]?.toUpperCase())
        .filter((s): s is string => Boolean(s))
    ),
  ];
  if (symbolMissing.length === 0) return primary;

  try {
    const res = await fetch(
      `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${encodeURIComponent(symbolMissing.join(","))}&tsyms=USD`
    );
    if (!res.ok) return primary;
    const data = await res.json();
    const filled = { ...primary };
    for (const id of missing) {
      const sym = symbolsByCoin[id]?.toUpperCase();
      const price = sym ? data?.[sym]?.USD : undefined;
      if (typeof price === "number" && price > 0) {
        filled[id] = price;
      }
    }
    return filled;
  } catch {
    return primary;
  }
}

/**
 * Returns the coin's historical USD prices for the requested number of days
 * as [timestamp_ms, price][]. CoinGecko auto-selects granularity from days.
 */
export async function getMarketChart(
  coinId: string,
  days: number
): Promise<[number, number][]> {
  try {
    const res = await throttledFetch(
      `${BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.prices ?? []) as [number, number][];
  } catch {
    return [];
  }
}

/** Result of a historical-price lookup with source attribution. */
export interface HistoricalPriceResult {
  price: number;
  source: string;
}

// A single wrong/stale number from one provider must never reach the ledger,
// so a price only counts as "real" once two of the three independent sources
// (CoinGecko, CryptoCompare, Binance) agree within this relative tolerance.
// Daily closes across venues rarely match to the cent, so this is a percentage
// band rather than a literal decimal match.
const AGREEMENT_TOLERANCE = 0.005;

function pricesAgree(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(a - b) / Math.max(a, b) <= AGREEMENT_TOLERANCE;
}

export const PRICE_PROVIDERS = ["CoinGecko", "CryptoCompare", "Binance"] as const;
export type PriceProvider = (typeof PRICE_PROVIDERS)[number];

/**
 * Returns the coin's USD price on a specific ISO date (YYYY-MM-DD) by querying
 * CoinGecko, CryptoCompare, and Binance in parallel and requiring at least two
 * of the three to agree (within AGREEMENT_TOLERANCE) before trusting the value.
 * Returns null if fewer than two independent sources corroborate each other —
 * the caller is expected to retry rather than accept an unverified number.
 * `onProgress` fires as soon as each individual provider settles, so callers
 * can show live per-source status instead of one opaque loading state.
 */
export async function getPriceOnDate(
  coinId: string,
  coinSymbol: string,
  isoDate: string,
  onProgress?: (provider: PriceProvider, price: number | null) => void
): Promise<HistoricalPriceResult | null> {
  const track = (provider: PriceProvider, promise: Promise<number | null>) =>
    promise.then(
      (price) => {
        onProgress?.(provider, price);
        return price !== null ? { price, source: provider } : null;
      },
      () => {
        onProgress?.(provider, null);
        return null;
      }
    );

  const [cg, cc, bn] = await Promise.all([
    track("CoinGecko", cgHistoryPrice(coinId, isoDate)),
    track("CryptoCompare", cryptoComparePrice(coinSymbol, isoDate)),
    track("Binance", binanceKlinePrice(coinSymbol, isoDate)),
  ]);

  const candidates = [cg, cc, bn].filter(
    (c): c is { price: number; source: PriceProvider } => c !== null
  );

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (a && b && pricesAgree(a.price, b.price)) {
        const price = (a.price + b.price) / 2;
        return { price, source: `${a.source} + ${b.source}` };
      }
    }
  }

  return null;
}

async function cgHistoryPrice(
  coinId: string,
  isoDate: string
): Promise<number | null> {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return null;
  const cgDate = `${d}-${m}-${y}`;
  try {
    const res = await throttledFetch(
      `${BASE}/coins/${encodeURIComponent(coinId)}/history?date=${cgDate}&localization=false`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.market_data?.current_price?.usd;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

async function binanceKlinePrice(
  symbol: string,
  isoDate: string
): Promise<number | null> {
  if (!symbol) return null;
  const dayStart = new Date(isoDate + "T00:00:00Z").getTime();
  if (!Number.isFinite(dayStart)) return null;
  const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
  const pair = `${symbol.toUpperCase()}USDT`;
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=1d&startTime=${dayStart}&endTime=${dayEnd}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const close = data?.[0]?.[4];
    const price = close !== undefined ? parseFloat(close) : null;
    return typeof price === "number" && Number.isFinite(price) && price > 0
      ? price
      : null;
  } catch {
    return null;
  }
}

async function cryptoComparePrice(
  symbol: string,
  isoDate: string
): Promise<number | null> {
  const ts = Math.floor(new Date(isoDate + "T12:00:00Z").getTime() / 1000);
  if (!Number.isFinite(ts) || !symbol) return null;
  const sym = symbol.toUpperCase();
  try {
    const res = await fetch(
      `https://min-api.cryptocompare.com/data/pricehistorical?fsym=${encodeURIComponent(sym)}&tsyms=USD&ts=${ts}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.[sym]?.USD;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}
