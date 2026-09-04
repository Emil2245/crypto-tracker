import { useState } from "react";
import {
  Layers,
  Pencil,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoinMark } from "@/components/CoinMark";
import { ReturnBadge } from "@/components/ReturnBadge";
import { SortHeader, type SortDir } from "@/components/SortHeader";
import {
  currentValue,
  formatAmountCompact,
  formatCurrency,
  initialValue,
  valueDifference,
  pctChange,
} from "@/lib/calculations";
import type { Holding, Transaction } from "@/types";

interface CoinDetailDialogProps {
  holding: Holding;
  transactions: Transaction[];
  price?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fires when the user taps the edit icon on a transaction row. */
  onEdit?: (transaction: Transaction) => void;
}

type SortKey = "date" | "amount" | "price" | "total";

const SORTABLE_COLS: { key: SortKey; label: string; align: "left" | "right" }[] =
  [
    { key: "date", label: "Date", align: "left" },
    { key: "amount", label: "Amount", align: "right" },
    { key: "price", label: "Price", align: "right" },
    { key: "total", label: "You paid", align: "right" },
  ];

export function CoinDetailDialog({
  holding,
  transactions,
  price,
  open: openProp,
  onOpenChange,
  onEdit,
}: CoinDetailDialogProps) {
  const open = openProp ?? false;
  const setOpen = onOpenChange ?? (() => {});
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const hasPrice = price !== undefined;
  const invested = initialValue(holding);
  const current = hasPrice ? currentValue(holding, price) : invested;
  const diff = hasPrice ? valueDifference(holding, price) : 0;
  const pct = pctChange(current, invested);
  const isPositive = diff >= 0;
  const returnColor = isPositive ? "var(--gain)" : "var(--loss)";
  const returnBg = isPositive ? "var(--gain-soft)" : "var(--loss-soft)";

  const txRows = sortTransactions(transactions, sortKey, sortDir);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        {/* ── TOP HALF · asset snapshot ─────────────────────────────── */}
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex items-center gap-3">
              <CoinMark
                symbol={holding.coinSymbol}
                image={holding.coinImage}
                size={44}
              />
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  {holding.coinName}
                </DialogTitle>
                <p className="mt-0.5 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {holding.coinSymbol.toUpperCase()} · {holding.transactionCount}{" "}
                  {holding.transactionCount === 1 ? "buy" : "buys"}
                </p>
              </div>
            </div>
            {/* Worth now */}
            <div className="text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Worth now
              </p>
              <p className="mt-0.5 font-mono tabular text-lg font-bold">
                {hasPrice ? formatCurrency(current) : formatCurrency(invested)}
              </p>
            </div>
          </div>

          {/* Return badge */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: returnBg }}>
            <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: returnColor }}>
              Total return
            </span>
            {hasPrice ? (
              <ReturnBadge diff={diff} pct={pct} size="small" />
            ) : (
              <span className="font-mono tabular text-sm font-bold">—</span>
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Amount" value={`${formatAmountCompact(holding.amount)} ${holding.coinSymbol.toUpperCase()}`} />
            <Stat label="Avg cost" value={formatCurrency(holding.purchasePrice)} />
            <Stat label="Invested" value={formatCurrency(invested)} />
            <Stat
              label="Price now"
              value={hasPrice ? formatCurrency(price!) : "—"}
            />
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            {holding.transactionCount} {holding.transactionCount === 1 ? "transaction" : "transactions"} · since {holding.purchaseDate}
          </div>
        </div>

        {/* ── BOTTOM HALF · transactions table ─────────────────────── */}
        <div className="flex max-h-[45vh] flex-col border-t border-border bg-secondary/30">
          <div className="flex shrink-0 items-center gap-2 px-6 pt-4 pb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold tracking-tight">Transactions</p>
            <p className="ml-1 text-xs font-medium text-muted-foreground">
              {transactions.length} total
            </p>
          </div>

          {txRows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No transactions recorded yet.
            </p>
          ) : (
            <div className="overflow-y-auto pb-2">
              {/* Desktop/tablet header row with sortable columns */}
              <div
                className="hidden grid-cols-[1.1fr_1fr_1fr_1.2fr_2rem] gap-3 border-y border-border px-6 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground sm:grid"
              >
                {SORTABLE_COLS.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    align={col.align}
                    active={sortKey === col.key}
                    dir={sortDir}
                    onClick={() => toggleSort(col.key)}
                    id={`detail-sort-${col.label.toLowerCase().replace(/\s/g, "-")}`}
                  />
                ))}
                <span />
              </div>

              <ul className="px-1">
                {txRows.map((t) => (
                  <li
                    key={t.id}
                    className="border-b border-border/50 last:border-0 sm:border-0"
                  >
                    {/* MOBILE — two-line row */}
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3 sm:hidden">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tracking-tight">
                          {t.purchaseDate}
                        </p>
                        <p className="mt-0.5 font-mono tabular text-[0.7rem] font-medium text-muted-foreground">
                          {formatAmountCompact(t.amount)}{" "}
                          {holding.coinSymbol.toUpperCase()} @{" "}
                          {formatCurrency(t.purchasePrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono tabular text-sm font-bold">
                          {formatCurrency(t.amount * t.purchasePrice)}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          You paid
                        </p>
                      </div>
                      {onEdit && (
                        <EditButton
                          label={`Edit ${t.purchaseDate} transaction`}
                          onClick={() => onEdit(t)}
                        />
                      )}
                    </div>

                    {/* DESKTOP/TABLET — grid row */}
                    <div
                      className="hidden items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-secondary/60 sm:grid sm:grid-cols-[1.1fr_1fr_1fr_1.2fr_2rem]"
                    >
                      <span className="font-medium text-muted-foreground">
                        {t.purchaseDate}
                      </span>
                      <span className="text-right font-mono tabular">
                        {formatAmountCompact(t.amount)}{" "}
                        <span className="text-[0.7rem] text-muted-foreground">
                          {holding.coinSymbol.toUpperCase()}
                        </span>
                      </span>
                      <span className="text-right font-mono tabular">
                        {formatCurrency(t.purchasePrice)}
                      </span>
                      <span className="text-right font-mono tabular font-semibold">
                        {formatCurrency(t.amount * t.purchasePrice)}
                      </span>
                      <div className="flex justify-center">
                        {onEdit && (
                          <EditButton
                            label={`Edit ${t.purchaseDate} transaction`}
                            onClick={() => onEdit(t)}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      id={`detail-edit-${label}`}
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}

function sortTransactions(
  transactions: Transaction[],
  key: SortKey,
  dir: SortDir
): Transaction[] {
  const factor = dir === "asc" ? 1 : -1;
  const rows = [...transactions];
  rows.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "date":
        cmp = a.purchaseDate.localeCompare(b.purchaseDate);
        break;
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "price":
        cmp = a.purchasePrice - b.purchasePrice;
        break;
      case "total":
        cmp = a.amount * a.purchasePrice - b.amount * b.purchasePrice;
        break;
    }
    return cmp * factor;
  });
  return rows;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-secondary/60 px-3.5 py-3">
      <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono tabular text-sm font-bold leading-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
