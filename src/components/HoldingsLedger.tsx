import React, { useMemo, useState } from "react";
import { ChevronDown, Menu, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import { DeleteHoldingDialog } from "@/components/DeleteHoldingDialog";
import { TransactionPickerDialog } from "@/components/TransactionPickerDialog";
import { CoinDetailDialog } from "@/components/CoinDetailDialog";
import { CoinMark } from "@/components/CoinMark";
import { ReturnBadge } from "@/components/ReturnBadge";
import { SortHeader, type SortDir } from "@/components/SortHeader";
import {
  formatCurrency,
  formatAmountCompact,
  initialValue,
  currentValue,
  valueDifference,
  daysSincePurchase,
  averageDailyChange,
  pctChange,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/contexts/PortfolioContext";
import type { Holding, Transaction, TransactionInput } from "@/types";

type FilterKey = "all" | "gainers" | "losers";

type SortKey = "asset" | "price" | "day1" | "today" | "dayDelta" | "return";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
];

const INITIAL_LIMIT = 5;

function coinSubtext(holding: Holding, days: number): string {
  const base = `${holding.coinSymbol.toUpperCase()} · ${days}d · ${formatAmountCompact(holding.amount)}`;
  return holding.transactionCount > 1
    ? `${base} · ${holding.transactionCount} buys`
    : base;
}

export function HoldingsLedger() {
  const {
    holdings,
    prices,
    getTransactions,
    onAdd,
    onUpdateTransaction,
    onDelete,
  } = usePortfolio();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("asset");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    let rows = holdings;
    if (filter === "gainers" || filter === "losers") {
      rows = holdings.filter((h) => {
        const p = prices[h.coinId];
        if (p === undefined) return false;
        const diff = valueDifference(h, p);
        return filter === "gainers" ? diff >= 0 : diff < 0;
      });
    }
    return sortHoldings(rows, prices, sortKey, sortDir);
  }, [holdings, prices, filter, sortKey, sortDir]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "asset" ? "asc" : "desc");
    }
  }

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
        <div className="hidden gap-5 border-b border-border px-4 pb-3 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase md:grid md:[grid-template-columns:2.2fr_1fr_1fr_1fr_1fr_1.3fr]">
          <SortHeader
            label="Asset"
            active={sortKey === "asset"}
            dir={sortDir}
            onClick={() => toggleSort("asset")}
          />
          <SortHeader
            label="Price"
            align="right"
            active={sortKey === "price"}
            dir={sortDir}
            onClick={() => toggleSort("price")}
          />
          <SortHeader
            label="Day one"
            align="right"
            active={sortKey === "day1"}
            dir={sortDir}
            onClick={() => toggleSort("day1")}
          />
          <SortHeader
            label="Today"
            align="right"
            active={sortKey === "today"}
            dir={sortDir}
            onClick={() => toggleSort("today")}
          />
          <SortHeader
            label="Δ / day"
            align="right"
            active={sortKey === "dayDelta"}
            dir={sortDir}
            onClick={() => toggleSort("dayDelta")}
          />
          <SortHeader
            label="Total return"
            align="right"
            active={sortKey === "return"}
            dir={sortDir}
            onClick={() => toggleSort("return")}
          />
        </div>

        <ol className="flex flex-col gap-0.5">
          {visible.map((holding) => (
            <li key={holding.coinId}>
              <PositionRow
                holding={holding}
                price={prices[holding.coinId]}
                getTransactions={getTransactions}
                onAdd={onAdd}
                onUpdateTransaction={onUpdateTransaction}
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
  getTransactions: (coinId: string) => Promise<Transaction[]>;
  onAdd: (transaction: TransactionInput) => void;
  onUpdateTransaction: (
    id: number,
    updates: Partial<Omit<Transaction, "id" | "createdAt">>
  ) => void;
  onDelete: (coinId: string) => void;
}

const PositionRow = React.memo(function PositionRow({
  holding,
  price,
  getTransactions,
  onAdd,
  onUpdateTransaction,
  onDelete,
}: PositionRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTxs, setDetailTxs] = useState<Transaction[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const hasPrice = price !== undefined;
  const day1 = initialValue(holding);
  const today = hasPrice ? currentValue(holding, price) : day1;
  const diff = hasPrice ? valueDifference(holding, price) : 0;
  const dayDelta = hasPrice ? averageDailyChange(holding, price) : 0;
  const pct = pctChange(today, day1);
  const days = daysSincePurchase(holding);
  const isPositive = diff >= 0;
  const returnColor = isPositive ? "var(--gain)" : "var(--loss)";
  const returnBg = isPositive ? "var(--gain-soft)" : "var(--loss-soft)";
  const dayColor =
    dayDelta === 0 ? "var(--muted-foreground)" : dayDelta > 0 ? "var(--gain)" : "var(--loss)";

  async function openEdit() {
    const rows = await getTransactions(holding.coinId);
    setTxs(rows);
    if (rows.length <= 1) {
      setEditingTx(rows[0] ?? null);
      setEditOpen(true);
    } else {
      setPickerOpen(true);
    }
  }

  async function openDetail() {
    const rows = await getTransactions(holding.coinId);
    setDetailTxs(rows);
    setDetailOpen(true);
  }

  function handlePickTransaction(tx: Transaction) {
    setEditingTx(tx);
    setEditOpen(true);
  }

  function handleDetailEdit(tx: Transaction) {
    setDetailOpen(false);
    setEditingTx(tx);
    setEditOpen(true);
  }

  const addCoin = useMemo(() => ({
    id: holding.coinId,
    name: holding.coinName,
    symbol: holding.coinSymbol,
    image: holding.coinImage,
  }), [holding.coinId, holding.coinName, holding.coinSymbol, holding.coinImage]);

  const pickerCoin = useMemo(() => ({
    coinId: holding.coinId,
    coinName: holding.coinName,
    coinSymbol: holding.coinSymbol,
    coinImage: holding.coinImage,
  }), [holding.coinId, holding.coinName, holding.coinSymbol, holding.coinImage]);

  const menuItems = (suffix: string) => (
    <>
      <DropdownMenuItem id={`edit-holding-${suffix}${holding.coinId}`} onClick={openEdit}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem
        id={`add-tx-${suffix}${holding.coinId}`}
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add transaction
      </DropdownMenuItem>
      <DropdownMenuItem
        id={`delete-holding-${suffix}${holding.coinId}`}
        variant="destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      {/* ── MOBILE card (hidden on md+) ─────────────────────────────── */}
      <div
        onClick={openDetail}
        className="flex cursor-pointer flex-col gap-2.5 rounded-2xl bg-secondary/40 p-3.5 transition-colors hover:bg-secondary active:bg-secondary/70 md:hidden"
      >
        {/* Header row: coin + menu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <CoinMark
              symbol={holding.coinSymbol}
              image={holding.coinImage}
              size={36}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {holding.coinName}
              </p>
              <p className="mt-0.5 truncate font-mono text-[0.68rem] font-medium text-muted-foreground">
                {coinSubtext(holding, days)}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-xl"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    id={`row-menu-mob-${holding.coinId}`}
                  >
                    <Menu className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">{menuItems("mob-")}</DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats 2×2 grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/50 pt-2.5">
          <MobileStat label="Price" value={hasPrice ? formatCurrency(price!) : "—"} />
          <MobileStat label="Day one" value={formatCurrency(day1)} muted />
          <MobileStat label="Today" value={hasPrice ? formatCurrency(today) : "—"} />
          <MobileStat
            label="Δ / day"
            value={hasPrice ? `${dayDelta >= 0 ? "+" : ""}${formatCurrency(dayDelta)}` : "—"}
            color={hasPrice ? dayColor : undefined}
          />
        </div>

        {/* Total return — full width */}
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: returnBg }}
        >
          <span className="text-[0.68rem] font-semibold uppercase tracking-wider" style={{ color: returnColor }}>
            Total return
          </span>
          {hasPrice ? (
            <ReturnBadge diff={diff} pct={pct} size="compact" />
          ) : (
            <span className="font-mono tabular text-sm font-bold">—</span>
          )}
        </div>
      </div>

      {/* ── DESKTOP row (hidden below md) ───────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          }
        }}
        className="group hidden md:grid md:[grid-template-columns:2.2fr_1fr_1fr_1fr_1fr_1.3fr] cursor-pointer items-center gap-5 rounded-2xl px-4 py-3 transition-colors hover:bg-secondary active:bg-secondary/70"
      >
        {/* Asset */}
        <div className="flex items-center gap-4">
          <CoinMark
            symbol={holding.coinSymbol}
            image={holding.coinImage}
            size={40}
          />
          <div className="min-w-0">
            <p className="truncate text-[0.95rem] font-semibold tracking-tight">
              {holding.coinName}
            </p>
            <p className="mt-0.5 truncate font-mono tabular text-[0.7rem] font-medium text-muted-foreground">
              {coinSubtext(holding, days)}
            </p>
          </div>
        </div>

        {/* Price now */}
        <div className="text-right font-mono tabular text-sm font-semibold">
          {hasPrice ? formatCurrency(price!) : <span className="text-muted-foreground">—</span>}
        </div>

        {/* Day one */}
        <div className="text-right font-mono tabular text-sm font-medium text-muted-foreground">
          {formatCurrency(day1)}
        </div>

        {/* Today */}
        <div className="text-right font-mono tabular text-sm font-semibold">
          {hasPrice ? formatCurrency(today) : "—"}
        </div>

        {/* Δ / day */}
        <div
          className="text-right font-mono tabular text-sm font-semibold"
          style={{ color: dayColor }}
        >
          {hasPrice ? `${dayDelta >= 0 ? "+" : ""}${formatCurrency(dayDelta)}` : "—"}
        </div>

        {/* Total return + actions */}
        <div className="flex items-center justify-end gap-2">
          {hasPrice ? (
            <ReturnBadge diff={diff} pct={pct} size="compact" />
          ) : (
            <p className="font-mono tabular text-sm text-muted-foreground">—</p>
          )}

          <div className="ml-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-xl"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    id={`row-menu-${holding.coinId}`}
                  >
                    <Menu className="h-3.5 w-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">{menuItems("")}</DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Shared dialogs (rendered once, outside both layouts) */}
      <AddHoldingDialog
        key={editingTx?.id ?? "none"}
        editTransaction={editingTx ?? undefined}
        onSubmit={(data) => {
          if (editingTx?.id) onUpdateTransaction(editingTx.id, data);
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AddHoldingDialog
        key={`add-${holding.coinId}`}
        lockedCoin={addCoin}
        onSubmit={onAdd}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <TransactionPickerDialog
        coin={pickerCoin}
        transactions={txs}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickTransaction}
      />
      <DeleteHoldingDialog
        holding={holding}
        price={price}
        onConfirm={() => onDelete(holding.coinId)}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
      <CoinDetailDialog
        holding={holding}
        transactions={detailTxs}
        price={price}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={handleDetailEdit}
      />
    </>
  );
});

function sortHoldings(
  holdings: Holding[],
  prices: Record<string, number>,
  key: SortKey,
  dir: SortDir
): Holding[] {
  const factor = dir === "asc" ? 1 : -1;
  const rows = [...holdings];
  rows.sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "asset":
        cmp = a.coinName.localeCompare(b.coinName);
        break;
      case "price": {
        const pa = prices[a.coinId];
        const pb = prices[b.coinId];
        cmp = (pa ?? 0) - (pb ?? 0);
        break;
      }
      case "day1":
        cmp = initialValue(a) - initialValue(b);
        break;
      case "today": {
        const pa = prices[a.coinId] ?? 0;
        const pb = prices[b.coinId] ?? 0;
        cmp = currentValue(a, pa) - currentValue(b, pb);
        break;
      }
      case "dayDelta": {
        const pa = prices[a.coinId] ?? 0;
        const pb = prices[b.coinId] ?? 0;
        cmp = averageDailyChange(a, pa) - averageDailyChange(b, pb);
        break;
      }
      case "return": {
        const pa = prices[a.coinId] ?? 0;
        const pb = prices[b.coinId] ?? 0;
        cmp = valueDifference(a, pa) - valueDifference(b, pb);
        break;
      }
    }
    return cmp * factor;
  });
  return rows;
}

/** A small label + value pair used inside the mobile card's 2×2 stats grid. */
function MobileStat({
  label,
  value,
  muted,
  color,
}: {
  label: string;
  value: string;
  muted?: boolean;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="font-mono tabular text-xs font-semibold"
        style={color ? { color } : muted ? { color: "var(--muted-foreground)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
