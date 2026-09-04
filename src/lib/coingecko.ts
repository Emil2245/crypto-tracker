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
  source: "CoinGecko" | "CoinGecko Range" | "CryptoCompare";
}

/**
 * Returns the coin's USD price on a specific ISO date (YYYY-MM-DD), cascading
 * through CoinGecko /history → CoinGecko /market_chart/range → CryptoCompare.
 * Returns null only when every source is unreachable or has no data.
 */
export async function getPriceOnDate(
  coinId: string,
  coinSymbol: string,
  isoDate: string
): Promise<HistoricalPriceResult | null> {
  const cg = await cgHistoryPrice(coinId, isoDate);
  if (cg !== null) return { price: cg, source: "CoinGecko" };

  const cgr = await cgRangePrice(coinId, isoDate);
  if (cgr !== null) return { price: cgr, source: "CoinGecko Range" };

  const cc = await cryptoComparePrice(coinSymbol, isoDate);
  if (cc !== null) return { price: cc, source: "CryptoCompare" };

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

async function cgRangePrice(
  coinId: string,
  isoDate: string
): Promise<number | null> {
  const ts = Math.floor(new Date(isoDate + "T12:00:00Z").getTime() / 1000);
  if (!Number.isFinite(ts)) return null;
  const from = ts - 12 * 3600;
  const to = ts + 12 * 3600;
  try {
    const res = await throttledFetch(
      `${BASE}/coins/${encodeURIComponent(coinId)}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const prices = (data?.prices ?? []) as [number, number][];
    if (prices.length === 0) return null;
    const targetMs = ts * 1000;
    const nearest = prices.reduce((best, p) =>
      Math.abs(p[0] - targetMs) < Math.abs(best[0] - targetMs) ? p : best
    );
    return nearest[1] ?? null;
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
