import useSWR from "swr";
import { getMarketChart } from "@/lib/coingecko";
import type { Holding } from "@/types";

export interface PortfolioPoint {
  t: number;
  v: number;
}

const HISTORY_REFRESH_INTERVAL = 15 * 60 * 1000;

/**
 * Fetches per-coin market charts and sums into a single portfolio timeline.
 * When a coin's history is unavailable (rate-limit, tier restriction, unknown
 * ID) it falls back to a flat line at `currentPrices[coinId] × amount`, so the
 * total stays honest at "now" even when one series is missing.
 */
export function usePortfolioHistory(
  holdings: Holding[],
  days: number,
  currentPrices: Record<string, number>
) {
  const coinIds = [...new Set(holdings.map((h) => h.coinId))].sort();
  const key = coinIds.length ? ["history", coinIds.join(","), days] : null;

  const { data, isLoading, error } = useSWR(
    key,
    async () => {
      const charts = await Promise.all(
        coinIds.map(async (id) => ({
          id,
          prices: await getMarketChart(id, days),
        }))
      );
      return buildTimeline(charts, holdings, currentPrices);
    },
    { refreshInterval: HISTORY_REFRESH_INTERVAL, revalidateOnFocus: false }
  );

  return {
    data: data ?? [],
    loading: isLoading && !data,
    error: error ? "History unavailable" : null,
  };
}

function buildTimeline(
  charts: { id: string; prices: [number, number][] }[],
  holdings: Holding[],
  currentPrices: Record<string, number>
): PortfolioPoint[] {
  const amountByCoin = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.coinId] = (acc[h.coinId] ?? 0) + h.amount;
    return acc;
  }, {});
  // Weighted-average cost basis per coin across all transactions.
  const costBasisByCoin = holdings.reduce<Record<string, number>>((acc, h) => {
    acc[h.coinId] = (acc[h.coinId] ?? 0) + h.amount * h.purchasePrice;
    return acc;
  }, {});
  const avgPriceByCoin: Record<string, number> = {};
  for (const id of Object.keys(amountByCoin)) {
    const totalAmt = amountByCoin[id] ?? 0;
    avgPriceByCoin[id] = totalAmt > 0 ? (costBasisByCoin[id] ?? 0) / totalAmt : 0;
  }

  // Pick the densest available series as the timestamp grid.
  const grid = charts
    .slice()
    .sort((a, b) => b.prices.length - a.prices.length)[0]?.prices ?? [];
  if (grid.length === 0) return [];

  const seriesByCoin: Record<string, [number, number][]> = {};
  for (const c of charts) seriesByCoin[c.id] = c.prices;

  return grid.map(([t]) => {
    let total = 0;
    for (const id of Object.keys(amountByCoin)) {
      const series = seriesByCoin[id];
      if (series && series.length > 0) {
        total += nearestPrice(series, t) * amountByCoin[id];
      } else {
        // History unavailable for this coin — hold flat at whichever fallback
        // we have (live price, else purchase price). Prevents the whole line
        // collapsing to $0 because one coin's chart didn't come back.
        const fallback =
          currentPrices[id] ?? avgPriceByCoin[id] ?? 0;
        total += fallback * amountByCoin[id];
      }
    }
    return { t, v: total };
  });
}

function nearestPrice(series: [number, number][], t: number): number {
  if (series.length === 0) return 0;
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo][1] ?? series[0][1];
}
