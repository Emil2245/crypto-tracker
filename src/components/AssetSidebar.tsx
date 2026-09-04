import { useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CoinMark } from "@/components/CoinMark";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import {
  formatCurrency,
  formatAmountCompact,
  currentValue,
  initialValue,
  pctChange,
} from "@/lib/calculations";
import type { Holding, TransactionInput } from "@/types";
import { cn } from "@/lib/utils";

interface AssetSidebarProps {
  holdings: Holding[];
  prices: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onReorder: (orderedCoinIds: string[]) => void;
  onAdd: (transaction: TransactionInput) => void;
}

type SortMode = "custom" | "value-desc" | "value-asc";

const SORT_MODES: {
  key: SortMode;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
    {
      key: "custom",
      label: "Custom",
      hint: "Drag rows to reorder",
      Icon: GripVertical,
    },
    {
      key: "value-desc",
      label: "Value ↓",
      hint: "Largest position first",
      Icon: ArrowDownWideNarrow,
    },
    {
      key: "value-asc",
      label: "Value ↑",
      hint: "Smallest position first",
      Icon: ArrowUpNarrowWide,
    },
  ];

export function AssetSidebar({
  holdings,
  prices,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapsed,
  onReorder,
  onAdd,
}: AssetSidebarProps) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    const rows = holdings.slice();
    if (sortMode === "custom") {
      rows.sort(
        (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt)
      );
    } else {
      rows.sort((a, b) => {
        const va = prices[a.coinId]
          ? currentValue(a, prices[a.coinId])
          : initialValue(a);
        const vb = prices[b.coinId]
          ? currentValue(b, prices[b.coinId])
          : initialValue(b);
        return sortMode === "value-desc" ? vb - va : va - vb;
      });
    }
    return rows;
  }, [holdings, prices, sortMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (h) =>
        h.coinName.toLowerCase().includes(q) ||
        h.coinSymbol.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  function handleDrop(targetCoinId: string) {
    if (dragId === null || dragId === targetCoinId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const ids = sorted.map((h) => h.coinId);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetCoinId);
    if (from === -1 || to === -1) return;
    const next = ids.slice();
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    onReorder(next);
    setDragId(null);
    setOverId(null);
  }

  const currentSort = SORT_MODES.find((s) => s.key === sortMode)!;

  // ── MOBILE horizontal strip (hidden on lg+) ──────────────────────────────
  const mobileStrip = (
    <div className="lg:hidden">
      <div className="flex items-center gap-2">
        {/* scrollable coin chips */}
        <div
          ref={stripRef}
          className="flex flex-1 gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {sorted.map((holding) => {
            const price = prices[holding.coinId];
            const cur = price ? currentValue(holding, price) : initialValue(holding);
            const pct = price ? pctChange(cur, initialValue(holding)) : 0;
            const isActive = selectedId === holding.coinId;
            return (
              <button
                key={holding.coinId}
                onClick={() => onSelect(isActive ? null : holding.coinId)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 transition-all",
                  isActive
                    ? "bg-accent-soft ring-2 ring-primary"
                    : "bg-secondary/60 hover:bg-secondary"
                )}
              >
                <CoinMark symbol={holding.coinSymbol} image={holding.coinImage} size={28} />
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight">
                    {holding.coinSymbol.toUpperCase()}
                  </p>
                  <p
                    className="font-mono text-[0.6rem] font-semibold leading-tight"
                    style={{ color: pct >= 0 ? "var(--gain)" : "var(--loss)" }}
                  >
                    {price ? `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {/* Add button */}
        <AddHoldingDialog
          onSubmit={onAdd}
          trigger={
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              aria-label="Add asset"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          }
        />
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <>
        {mobileStrip}
        <Card className="soft-card hidden lg:flex w-[76px] gap-3 self-start p-3">
          <CardContent className="flex flex-col items-center gap-3 p-0">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Expand assets"
              onClick={onToggleCollapsed}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <AddHoldingDialog
              onSubmit={onAdd}
              trigger={
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-2xl"
                  aria-label="Add asset"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </Button>
              }
            />
            <div className="h-px w-full bg-border" />
            <ScrollArea className="max-h-[640px] w-full">
              <ul className="flex flex-col items-center gap-2 py-1">
                {sorted.map((holding) => {
                  const isActive = selectedId === holding.coinId;
                  return (
                    <li key={holding.coinId}>
                      <button
                        onClick={() =>
                          onSelect(isActive ? null : holding.coinId)
                        }
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl transition-all",
                          isActive
                            ? "bg-accent-soft ring-2 ring-primary"
                            : "hover:bg-secondary"
                        )}
                        title={`${holding.coinName} — ${holding.coinSymbol.toUpperCase()}`}
                      >
                        <CoinMark
                          symbol={holding.coinSymbol}
                          image={holding.coinImage}
                          size={32}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {mobileStrip}
      <Card className="soft-card hidden lg:flex gap-4 self-start p-5">
        <CardContent className="flex flex-col gap-4 p-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold tracking-tight">Assets</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                {holdings.length} {holdings.length === 1 ? "holding" : "holdings"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="icon"
                      className="rounded-xl"
                      aria-label="Sort"
                    >
                      <currentSort.Icon className="h-4 w-4" />
                    </Button>
                  }
                />
                <PopoverContent align="end" className="w-56 p-1.5">
                  <div className="px-2 py-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Sort by
                  </div>
                  {SORT_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => setSortMode(mode.key)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-secondary",
                        sortMode === mode.key && "bg-accent-soft"
                      )}
                    >
                      <mode.Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <span className="flex-1">
                        <span className="block font-semibold leading-tight">
                          {mode.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {mode.hint}
                        </span>
                      </span>
                      {sortMode === mode.key && (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label="Collapse assets"
                onClick={onToggleCollapsed}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets…"
                className="h-11 rounded-full bg-secondary/70 pl-10 text-sm"
              />
            </div>
            <AddHoldingDialog
              onSubmit={onAdd}
              trigger={
                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
                  aria-label="Add asset"
                  id="sidebar-add-asset"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </Button>
              }
            />
          </div>

          <ScrollArea className="-mx-2 max-h-[640px] pr-2">
            <ul className="flex flex-col gap-1 px-2">
              {filtered.length === 0 && (
                <li className="py-10 text-center text-sm text-muted-foreground">
                  No matches
                </li>
              )}
              {filtered.map((holding) => {
                const price = prices[holding.coinId];
                const cur = price
                  ? currentValue(holding, price)
                  : initialValue(holding);
                const pct = price ? pctChange(cur, initialValue(holding)) : 0;
                const isActive = selectedId === holding.coinId;
                const isDragging = dragId === holding.coinId;
                const isOver = overId === holding.coinId;
                const canDrag = sortMode === "custom" && !query;

                return (
                  <li
                    key={holding.coinId}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!canDrag) return;
                      setDragId(holding.coinId);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (!canDrag || dragId === null) return;
                      e.preventDefault();
                      setOverId(holding.coinId);
                    }}
                    onDragLeave={() => {
                      if (overId === holding.coinId) setOverId(null);
                    }}
                    onDrop={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      handleDrop(holding.coinId);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    className={cn(
                      "transition-all",
                      isDragging && "opacity-40",
                      isOver &&
                      !isDragging &&
                      "translate-y-0.5 [box-shadow:inset_0_2px_0_var(--primary)]"
                    )}
                  >
                    <div
                      className={cn(
                        "group/row grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                        isActive
                          ? "bg-accent-soft shadow-[inset_3px_0_0_var(--primary)]"
                          : "hover:bg-secondary"
                      )}
                    >
                      {canDrag ? (
                        <span
                          className="flex h-9 w-4 cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing"
                          aria-hidden
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="w-1" aria-hidden />
                      )}
                      <button
                        onClick={() =>
                          onSelect(isActive ? null : holding.coinId)
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        id={`asset-${holding.coinId}`}
                      >
                        <CoinMark
                          symbol={holding.coinSymbol}
                          image={holding.coinImage}
                          size={38}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-tight">
                            {holding.coinName}
                          </p>
                          <p className="mt-0.5 truncate font-mono tabular text-[0.7rem] font-medium text-muted-foreground">
                            {formatAmountCompact(holding.amount)}{" "}
                            {holding.coinSymbol.toUpperCase()}
                            {holding.transactionCount > 1
                              ? ` · ${holding.transactionCount} buys`
                              : ""}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-mono tabular text-sm font-semibold">
                            {price ? formatCurrency(cur) : "—"}
                          </p>
                          {price && (
                            <p
                              className="mt-0.5 font-mono tabular text-[0.7rem] font-semibold"
                              style={{
                                color: pct >= 0 ? "var(--gain)" : "var(--loss)",
                              }}
                            >
                              {pct >= 0 ? "+" : ""}
                              {(pct * 100).toFixed(2)}%
                            </p>
                          )}
                        </div>
                        <AddHoldingDialog
                          onSubmit={onAdd}
                          lockedCoin={{
                            id: holding.coinId,
                            name: holding.coinName,
                            symbol: holding.coinSymbol,
                            image: holding.coinImage,
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-xl opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
                              aria-label={`Add transaction for ${holding.coinName}`}
                              id={`sidebar-add-tx-${holding.coinId}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>

          {sortMode === "custom" && !query && filtered.length > 1 && (
            <p className="text-center text-[0.7rem] font-medium text-muted-foreground">
              Drag rows to reorder
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
