import type { Holding } from "@/types";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_DETAIL_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});

export function initialValue(holding: Holding): number {
  return holding.amount * holding.purchasePrice;
}

export function currentValue(holding: Holding, currentPrice: number): number {
  return holding.amount * currentPrice;
}

export function valueDifference(
  holding: Holding,
  currentPrice: number
): number {
  return currentValue(holding, currentPrice) - initialValue(holding);
}

export function daysSincePurchase(holding: Holding): number {
  const purchaseMs = new Date(holding.purchaseDate).getTime();
  const nowMs = Date.now();
  return Math.max(1, Math.floor((nowMs - purchaseMs) / (1000 * 60 * 60 * 24)));
}

export function averageDailyChange(
  holding: Holding,
  currentPrice: number
): number {
  return valueDifference(holding, currentPrice) / daysSincePurchase(holding);
}

export function pctChange(current: number, basis: number): number {
  return basis > 0 ? (current - basis) / basis : 0;
}

export function formatCurrency(value: number): string {
  return USD_FMT.format(value);
}

export function formatCompact(value: number): string {
  return Math.abs(value) >= 1
    ? COMPACT_FMT.format(value)
    : COMPACT_DETAIL_FMT.format(value);
}

/** Compacts large coin amounts into "12.5M" / "3.2k" style strings for tight layouts. */
export function formatAmountCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "k";
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
