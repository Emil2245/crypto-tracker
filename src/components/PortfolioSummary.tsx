import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import { PortfolioChart } from "@/components/PortfolioChart";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  initialValue,
  currentValue,
  valueDifference,
  averageDailyChange,
} from "@/lib/calculations";
import type { Holding } from "@/types";

interface PortfolioSummaryProps {
  holdings: Holding[];
  prices: Record<string, number>;
  loading: boolean;
  onAdd: (holding: Omit<Holding, "id" | "createdAt" | "updatedAt">) => void;
}

// CoinGecko's free tier caps historical data at 365 days — 730 returns 401.
const RANGES = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
] as const;

export function PortfolioSummary({
  holdings,
  prices,
  loading,
  onAdd,
}: PortfolioSummaryProps) {
  const [rangeIdx, setRangeIdx] = useState(2);
  const days = RANGES[rangeIdx].days;
  const history = usePortfolioHistory(holdings, days, prices);

  const totalInvested = holdings.reduce((sum, h) => sum + initialValue(h), 0);
  const totalCurrent = holdings.reduce((sum, h) => {
    const p = prices[h.coinId];
    return sum + (p ? currentValue(h, p) : initialValue(h));
  }, 0);
  const totalDiff = holdings.reduce((sum, h) => {
    const p = prices[h.coinId];
    return sum + (p ? valueDifference(h, p) : 0);
  }, 0);
  const pctChange = totalInvested > 0 ? totalDiff / totalInvested : 0;
  const isPositive = totalDiff >= 0;

  const todayDelta = deriveTodayDelta(history.data);

  // Sum of each holding's own daily rate, rather than totalDiff over one
  // shared day-count — holdings bought on different dates shouldn't be
  // averaged over the same denominator.
  const avgPerDay = holdings.reduce((sum, h) => {
    const p = prices[h.coinId];
    return sum + (p ? averageDailyChange(h, p) : 0);
  }, 0);

  const dollars = Math.floor(totalCurrent);
  const cents = (totalCurrent - dollars).toFixed(2).slice(2);

  return (
    <Card className="soft-card gap-5 p-5 sm:gap-6 sm:p-8">
      <CardContent className="flex flex-col gap-6 p-0">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Total balance
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              {loading && !totalCurrent ? (
                <div className="h-10 w-48 animate-pulse rounded-2xl bg-muted sm:h-16 sm:w-64" />
              ) : (
                <>
                  <span className="tabular text-4xl font-bold tracking-[-0.035em] leading-none sm:text-6xl">
                    {formatDollars(dollars)}
                  </span>
                  <span className="tabular text-xl font-semibold tracking-[-0.02em] text-muted-foreground sm:text-2xl">
                    .{cents}
                  </span>
                </>
              )}
            </div>
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5"
              style={{
                background: isPositive ? "var(--gain-soft)" : "var(--loss-soft)",
                color: isPositive ? "var(--gain)" : "var(--loss)",
              }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                style={{ background: isPositive ? "var(--gain)" : "var(--loss)" }}
              >
                {isPositive ? (
                  <ArrowUp className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <ArrowDown className="h-3 w-3" strokeWidth={3} />
                )}
              </span>
              <span className="font-mono tabular text-sm font-semibold">
                {isPositive ? "+" : ""}
                {formatCurrency(totalDiff)}
              </span>
              <span className="opacity-40">·</span>
              <span className="font-mono tabular text-sm font-semibold">
                {isPositive ? "+" : ""}
                {(pctChange * 100).toFixed(2)}%
              </span>
              <span className="text-xs font-medium opacity-70">
                since acquisition
              </span>
            </div>
          </div>

          <div className="hidden sm:flex">
            <AddHoldingDialog onSubmit={onAdd} />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex w-full gap-1 rounded-full bg-secondary p-1 sm:w-auto sm:inline-flex">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className={cn(
                  "flex-1 rounded-full px-3.5 py-1.5 font-sans text-xs font-medium transition-colors sm:flex-none",
                  i === rangeIdx
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Portfolio value
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-border" /> Cost basis
            </span>
          </div>
        </div>

        <PortfolioChart
          data={history.data}
          loading={history.loading}
          costBasis={totalInvested}
        />

        {/* All 5 KPI cards in one responsive grid:
             mobile  : 2 cols — primary pair full width, secondary trio 2+1
             sm+     : 2 cols for primary, 3 cols for secondary (same as before) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            size="primary"
            label="Day one"
            value={formatCurrency(totalInvested)}
            hint={`${holdings.length} ${holdings.length === 1 ? "asset" : "assets"}`}
          />
          <StatCard
            size="primary"
            label="Today"
            value={formatCurrency(totalCurrent)}
            hint="current value"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total Δ"
            value={`${isPositive ? "+" : ""}${formatCurrency(totalDiff)}`}
            hint={`${isPositive ? "▲" : "▼"} ${(pctChange * 100).toFixed(2)}%`}
            tone={isPositive ? "gain" : "loss"}
          />
          <StatCard
            label="Avg / day"
            value={`${avgPerDay >= 0 ? "+" : ""}${formatCurrency(avgPerDay)}`}
            hint="since day one"
            tone={avgPerDay === 0 ? "neutral" : avgPerDay > 0 ? "gain" : "loss"}
          />
          <StatCard
            label="Today"
            value={
              todayDelta === null
                ? "—"
                : `${todayDelta >= 0 ? "+" : ""}${formatCurrency(todayDelta)}`
            }
            hint={
              todayDelta === null
                ? "awaiting"
                : `${todayDelta >= 0 ? "▲" : "▼"} ${(
                  (todayDelta /
                    Math.max(1, history.data[history.data.length - 2]?.v ?? totalCurrent)) *
                  100
                ).toFixed(2)}%`
            }
            tone={
              todayDelta === null ? "neutral" : todayDelta >= 0 ? "gain" : "loss"
            }
            spanFull
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  size = "secondary",
  spanFull = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "gain" | "loss";
  size?: "primary" | "secondary";
  spanFull?: boolean;
}) {
  const color =
    tone === "gain"
      ? "var(--gain)"
      : tone === "loss"
        ? "var(--loss)"
        : undefined;
  const isPrimary = size === "primary";
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl bg-secondary/60 px-3.5 py-3 sm:px-5 sm:py-4",
        spanFull && "col-span-2 sm:col-span-1"
      )}
    >
      {/* Label + hint on one line to save vertical space on mobile */}
      <div className="flex items-center justify-between gap-1">
        <p
          className={cn(
            "font-semibold uppercase tracking-wider text-muted-foreground",
            isPrimary ? "text-[0.65rem] sm:text-xs" : "text-[0.6rem] sm:text-[0.65rem]"
          )}
        >
          {label}
        </p>
        <span
          className="shrink-0 font-mono text-[0.6rem] font-medium"
          style={{ color: color ?? "var(--muted-foreground)" }}
        >
          {hint}
        </span>
      </div>
      {/* Value — scales up on larger screens */}
      <p
        className={cn(
          "mt-1.5 text-right font-mono tabular font-bold tracking-[-0.015em] leading-none",
          isPrimary
            ? "text-xl sm:text-3xl"
            : "text-base sm:text-2xl"
        )}
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

function formatDollars(dollars: number): string {
  return "$" + dollars.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function deriveTodayDelta(data: { t: number; v: number }[]): number | null {
  if (data.length < 2) return null;
  const last = data[data.length - 1];
  // Find the sample nearest 24h before the last point.
  const target = last.t - 24 * 60 * 60 * 1000;
  let best = data[0];
  for (const p of data) {
    if (Math.abs(p.t - target) < Math.abs(best.t - target)) best = p;
  }
  return last.v - best.v;
}
