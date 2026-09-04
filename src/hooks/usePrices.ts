import useSWR from "swr";
import { getPrices } from "@/lib/coingecko";
import type { Holding } from "@/types";

const REFRESH_INTERVAL = 5 * 60 * 1000;

export function usePrices(holdings: Holding[]) {
  const coinIds = [...new Set(holdings.map((h) => h.coinId))];
  const params = coinIds.join(",");

  const { data, isLoading, error, mutate } = useSWR(
    params ? ["prices", params] : null,
    async () => {
      const prices = await getPrices(coinIds);
      return { prices, timestamp: Date.now() };
    },
    { refreshInterval: REFRESH_INTERVAL }
  );

  return {
    prices: data?.prices ?? {},
    loading: isLoading && !data,
    lastUpdated: data?.timestamp ?? null,
    error: error ? "Prices unavailable" : null,
    refetch: () => mutate(),
  };
}