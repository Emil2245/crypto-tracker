import { useEffect, useState } from "react";
import { useControlledOpen } from "@/hooks/useControlledOpen";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Progress } from "@/components/ui/progress";
import { CoinSearch } from "@/components/CoinSearch";
import { getPriceOnDate, PRICE_PROVIDERS } from "@/lib/coingecko";
import { formatCurrency } from "@/lib/calculations";
import type { CoinSearchResult, Transaction, TransactionInput } from "@/types";
import { Loader2, Pencil, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDER_TOTAL = PRICE_PROVIDERS.length;

interface AddHoldingDialogProps {
  onSubmit: (transaction: TransactionInput) => void;
  editTransaction?: Transaction;
  /** When set, the coin is pre-selected and locked — only date/qty/price are editable. */
  lockedCoin?: { id: string; name: string; symbol: string; image?: string };
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function AddHoldingDialog({
  onSubmit,
  editTransaction,
  lockedCoin,
  trigger,
  open: openProp,
  onOpenChange,
}: AddHoldingDialogProps) {
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange);

  // Resolve the initial coin — from editTransaction, lockedCoin, or nothing.
  const initialCoin: CoinSearchResult | null = editTransaction
    ? {
      id: editTransaction.coinId,
      name: editTransaction.coinName,
      symbol: editTransaction.coinSymbol,
      thumb: editTransaction.coinImage || "",
    }
    : lockedCoin
      ? { id: lockedCoin.id, name: lockedCoin.name, symbol: lockedCoin.symbol, thumb: lockedCoin.image || "" }
      : null;

  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(initialCoin);

  const [amount, setAmount] = useState(
    editTransaction ? String(editTransaction.amount) : ""
  );
  const [purchasePrice, setPurchasePrice] = useState(
    editTransaction ? String(editTransaction.purchasePrice) : ""
  );
  const [purchaseDate, setPurchaseDate] = useState(
    editTransaction?.purchaseDate || todayIso()
  );
  const [autoPrice, setAutoPrice] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceAttempt, setPriceAttempt] = useState(0);
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [settled, setSettled] = useState(0);
  const progressPct = Math.round((settled / PROVIDER_TOTAL) * 100);

  const isEditing = !!editTransaction;

  // Auto-fetch the market price for the selected coin + date. Every failed
  // pass through all the providers triggers a backoff retry (3s, then 4.5s,
  // 6.75s… capped at 30s) — the effect doesn't give up until it gets a price,
  // the user flips the toggle off, or the dialog closes. `settled` counts how
  // many providers have responded on the current pass, driving the progress bar.
  useEffect(() => {
    if (!autoPrice || !selectedCoin || !purchaseDate) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function tryFetch() {
      if (cancelled) return;
      setPriceLoading(true);
      setSettled(0);
      const result = await getPriceOnDate(
        selectedCoin!.id,
        selectedCoin!.symbol,
        purchaseDate,
        () => {
          if (cancelled) return;
          setSettled((n) => n + 1);
        }
      );
      if (cancelled) return;
      if (result !== null) {
        setPurchasePrice(result.price.toString());
        setPriceSource(result.source);
        setPriceLoading(false);
        setPriceAttempt(0);
      } else {
        attempt += 1;
        setPriceAttempt(attempt);
        const delay = Math.min(3000 * Math.pow(1.5, attempt - 1), 30000);
        timer = setTimeout(tryFetch, delay);
      }
    }

    setPriceSource(null);
    setPriceAttempt(0);
    tryFetch();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [autoPrice, selectedCoin, purchaseDate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCoin || !amount || !purchasePrice || !purchaseDate) return;

    onSubmit({
      coinId: selectedCoin.id,
      coinName: selectedCoin.name,
      coinSymbol: selectedCoin.symbol,
      coinImage: selectedCoin.thumb,
      amount: parseFloat(amount),
      purchasePrice: parseFloat(purchasePrice),
      purchaseDate,
    });

    if (!isEditing) {
      setSelectedCoin(null);
      setAmount("");
      setPurchasePrice("");
      setPurchaseDate(todayIso());
      setAutoPrice(true);
    }
    setOpen(false);
  }

  const isValid = !(autoPrice && priceLoading) &&
    selectedCoin &&
    amount &&
    parseFloat(amount) > 0 &&
    purchasePrice &&
    parseFloat(purchasePrice) > 0 &&
    purchaseDate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(trigger || (openProp === undefined && !isEditing)) && (
        <DialogTrigger
          render={
            trigger || (
              <Button
                className="h-11 gap-2 rounded-2xl px-5 text-sm font-semibold"
                id="add-holding-trigger"
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: "var(--primary)" }}
                >
                  <Plus className="h-3 w-3" strokeWidth={3} color="white" />
                </span>
                Add asset
              </Button>
            )
          }
        />
      )}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {isEditing ? (
              <>
                <Pencil className="h-5 w-5 text-primary" />
                Edit transaction
              </>
            ) : lockedCoin ? (
              <>
                <Plus className="h-5 w-5 text-primary" />
                New transaction
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-primary" />
                New asset
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* 1 · Purchase date */}
          <div className="space-y-2">
            <Label htmlFor="date-input">
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary">1</span>
              Purchase date
            </Label>
            <DatePicker
              id="date-input"
              value={isoToDate(purchaseDate)}
              onChange={(d) => d && setPurchaseDate(dateToIso(d))}
              disabled={(date) => date > new Date()}
            />
          </div>

          {/* 2 · Asset */}
          <div className="space-y-2">
            <Label htmlFor="coin-search-input">
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary">2</span>
              Asset
            </Label>
            {lockedCoin ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm">
                <img
                  src={lockedCoin.image}
                  alt=""
                  className="h-6 w-6 rounded-full bg-background"
                />
                <span className="font-semibold">{lockedCoin.name}</span>
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  {lockedCoin.symbol}
                </span>
              </div>
            ) : (
              <CoinSearch
                onSelect={setSelectedCoin}
                value={
                  isEditing
                    ? `${editTransaction.coinName} (${editTransaction.coinSymbol.toUpperCase()})`
                    : undefined
                }
              />
            )}
            {selectedCoin && (
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
                <img
                  src={selectedCoin.thumb}
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
                <span className="font-semibold">{selectedCoin.name}</span>
                <span className="font-mono text-xs uppercase text-muted-foreground">
                  {selectedCoin.symbol}
                </span>
              </div>
            )}
          </div>

          {/* 3 · Quantity */}
          <div className="space-y-2">
            <Label htmlFor="amount-input">
              <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary">3</span>
              Quantity
            </Label>
            <Input
              id="amount-input"
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.5"
              className="h-11 rounded-xl font-mono text-right"
            />
          </div>

          {/* Price — automatic with manual override */}
          <div className="rounded-2xl border border-border bg-secondary/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="flex items-center gap-1.5 !mb-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Price at purchase date
                </Label>
                <p className="text-xs text-muted-foreground">
                  {autoPrice
                    ? priceLoading
                      ? priceAttempt > 0
                        ? `Feeds slow — retrying (attempt ${priceAttempt + 1})…`
                        : "Looking up the market close…"
                      : priceSource
                        ? `Auto-filled from ${priceSource}. Toggle off to override.`
                        : "Auto-fill will fetch when you pick a coin + date."
                    : "Manual entry — override the market price."}
                </p>
              </div>
              <Switch checked={autoPrice} onCheckedChange={setAutoPrice} />
            </div>

            {autoPrice && selectedCoin && priceLoading && (
              <div className="mt-3">
                <Progress value={progressPct} className="h-2" />
              </div>
            )}

            <div className="relative mt-3">
              <Input
                id="price-input"
                type="number"
                step="any"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                disabled={autoPrice && priceLoading}
                placeholder={priceLoading ? "Fetching…" : "65000"}
                className={cn(
                  "h-11 rounded-xl font-mono text-right pr-10",
                  autoPrice && "bg-background/60"
                )}
              />
              {priceLoading && (
                <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {amount && purchasePrice && (
            <div className="flex items-baseline justify-between rounded-xl bg-secondary px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cost basis
              </span>
              <span className="font-mono tabular text-lg font-bold">
                {formatCurrency(parseFloat(amount) * parseFloat(purchasePrice))}
              </span>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isValid}
            className="h-11 w-full rounded-2xl text-sm font-semibold"
          >
            {autoPrice && priceLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating price…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Add to ledger"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Label({
  className,
  children,
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2",
        className
      )}
    >
      {children}
    </label>
  );
}
