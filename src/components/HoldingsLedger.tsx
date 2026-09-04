import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import { CoinMark } from "@/components/CoinMark";
import {
  formatCurrency,
  initialValue,
  currentValue,
  valueDifference,
  daysSincePurchase,
  averageDailyChange,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import type { Holding } from "@/types";

interface HoldingsLedgerProps {
  holdings: Holding[];
  prices: Record<string, number>;
  onUpdate: (
    id: number,
    updates: Omit<Holding, "id" | "createdAt" | "updatedAt">
  ) => void;
  onDelete: (id: number) => void;
}

type FilterKey = "all" | "gainers" | "losers";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
];

const INITIAL_LIMIT = 5;

export function HoldingsLedger({
  holdings,
  prices,
  onUpdate,
  onDelete,
}: HoldingsLedgerProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return holdings;
    return holdings.filter((h) => {
      const p = prices[h.coinId];
      if (!p) return false;
      const diff = valueDifference(h, p);
      return filter === "gainers" ? diff >= 0 : diff < 0;
    });
  }, [holdings, prices, filter]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT);

  return (
    <Card className="soft-card gap-4 p-7">
      <CardContent className="flex flex-col gap-4 p-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold tracking-tight">Positions</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Each row: what you paid, what it's worth, the daily drift.
            </p>
          </div>
          <div className="inline-flex gap-1 rounded-full bg-secondary p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column heads */}
        <div className="hidden grid-cols-[2.4fr_1.2fr_1.2fr_1.2fr_1.4fr] gap-5 border-b border-border px-4 pb-3 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase md:grid">
          <span>Asset</span>
          <span className="text-right">Day one</span>
          <span className="text-right">Today</span>
          <span className="text-right">Δ / day</span>
          <span className="text-right">Total return</span>
        </div>

        <ol className="flex flex-col gap-0.5">
          {visible.map((holding) => (
            <li key={holding.id}>
              <PositionRow
                holding={holding}
                price={prices[holding.coinId]}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            </li>
          ))}
          {visible.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">
              No positions match this filter.
            </li>
          )}
        </ol>

        {filtered.length > INITIAL_LIMIT && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Showing {visible.length} of {filtered.length} positions
            </p>
            <Button
              variant="outline"
              onClick={() => setShowAll((s) => !s)}
              className="rounded-full"
            >
              {showAll ? "Show less" : "Show all"}
              <ChevronDown
                className={cn(
                  "ml-1 h-3 w-3 transition-transform",
                  showAll && "rotate-180"
                )}
              />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PositionRowProps {
  holding: Holding;
  price?: number;
  onUpdate: (
    id: number,
    updates: Omit<Holding, "id" | "createdAt" | "updatedAt">
  ) => void;
  onDelete: (id: number) => void;
}

function PositionRow({ holding, price, onUpdate, onDelete }: PositionRowProps) {
  const hasPrice = price !== undefined;
  const day1 = initialValue(holding);
  const today = hasPrice ? currentValue(holding, price) : day1;
  const diff = hasPrice ? valueDifference(holding, price) : 0;
  const dayDelta = hasPrice ? averageDailyChange(holding, price) : 0;
  const pct = day1 > 0 ? diff / day1 : 0;
  const days = daysSincePurchase(holding);
  const isPositive = diff >= 0;
  const returnColor = isPositive ? "var(--gain)" : "var(--loss)";
  const returnBg = isPositive ? "var(--gain-soft)" : "var(--loss-soft)";
  const dayColor =
    dayDelta === 0 ? "var(--muted-foreground)" : dayDelta > 0 ? "var(--gain)" : "var(--loss)";

  return (
    <div className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-secondary md:grid-cols-[2.4fr_1.2fr_1.2fr_1.2fr_1.4fr] md:gap-5 md:px-4">
      {/* Asset */}
      <div className="flex items-center gap-3.5 md:gap-4">
        <CoinMark
          symbol={holding.coinSymbol}
          image={holding.coinImage}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight md:text-[0.95rem]">
            {holding.coinName}
          </p>
          <p className="mt-0.5 truncate font-mono tabular text-[0.7rem] font-medium text-muted-foreground">
            {holding.coinSymbol.toUpperCase()} · {days}d · {formatShort(holding.amount)}
          </p>
        </div>
      </div>

      {/* Day one */}
      <div className="hidden text-right font-mono tabular text-sm font-medium text-muted-foreground md:block">
        {formatCurrency(day1)}
      </div>

      {/* Today */}
      <div className="hidden text-right font-mono tabular text-sm font-semibold md:block">
        {hasPrice ? formatCurrency(today) : "—"}
      </div>

      {/* Δ / day */}
      <div
        className="hidden text-right font-mono tabular text-sm font-semibold md:block"
        style={{ color: dayColor }}
      >
        {hasPrice
          ? `${dayDelta >= 0 ? "+" : ""}${formatCurrency(dayDelta)}`
          : "—"}
      </div>

      {/* Total return + hover actions */}
      <div className="flex items-center justify-end gap-2">
        <div className="text-right">
          {hasPrice ? (
            <>
              <p className="font-mono tabular text-base font-bold" style={{ color: returnColor }}>
                {isPositive ? "+" : ""}
                {formatCurrency(diff)}
              </p>
              <span
                className="mt-0.5 inline-block rounded-full px-2.5 py-0.5 font-mono tabular text-[0.68rem] font-semibold"
                style={{ background: returnBg, color: returnColor }}
              >
                {isPositive ? "▲" : "▼"} {(pct * 100).toFixed(2)}%
              </span>
            </>
          ) : (
            <p className="font-mono tabular text-sm text-muted-foreground">—</p>
          )}
        </div>

        <div className="ml-2 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <AddHoldingDialog
            editHolding={holding}
            onSubmit={(data) => holding.id && onUpdate(holding.id, data)}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-xl"
                id={`edit-holding-${holding.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-xl text-muted-foreground hover:text-[color:var(--loss)]"
            onClick={() => holding.id && onDelete(holding.id)}
            id={`delete-holding-${holding.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "k";
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
