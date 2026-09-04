import type { Holding } from "@/types";

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

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value);
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  // For small crypto amounts, show more decimals
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}
