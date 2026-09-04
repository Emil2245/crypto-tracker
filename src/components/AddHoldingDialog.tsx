import { useEffect, useState } from "react";
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
import { CoinSearch } from "@/components/CoinSearch";
import { getPriceOnDate } from "@/lib/coingecko";
import { formatCurrency } from "@/lib/calculations";
import type { CoinSearchResult, Holding } from "@/types";
import { Loader2, Pencil, Plus, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddHoldingDialogProps {
  onSubmit: (
    holding: Omit<Holding, "id" | "createdAt" | "updatedAt">
  ) => void;
  editHolding?: Holding;
  trigger?: React.ReactElement;
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
  editHolding,
  trigger,
}: AddHoldingDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(
    editHolding
      ? {
          id: editHolding.coinId,
          name: editHolding.coinName,
          symbol: editHolding.coinSymbol,
          thumb: editHolding.coinImage || "",
        }
      : null
  );
  const [amount, setAmount] = useState(
    editHolding ? String(editHolding.amount) : ""
  );
  const [purchasePrice, setPurchasePrice] = useState(
    editHolding ? String(editHolding.purchasePrice) : ""
  );
  const [purchaseDate, setPurchaseDate] = useState(
    editHolding?.purchaseDate || todayIso()
  );
  const [autoPrice, setAutoPrice] = useState(!editHolding);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceUnreachable, setPriceUnreachable] = useState(false);
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);

  const isEditing = !!editHolding;

  // Auto-fetch the market price for the selected coin + date, cascading through
  // three sources. Only the "everything is offline" case surfaces to the user,
  // as a gentle retry — never as a scary "manual only" verdict.
  useEffect(() => {
    if (!autoPrice || !selectedCoin || !purchaseDate) return;
    let cancelled = false;
    setPriceLoading(true);
    setPriceUnreachable(false);
    setPriceSource(null);
    getPriceOnDate(selectedCoin.id, selectedCoin.symbol, purchaseDate)
      .then((result) => {
        if (cancelled) return;
        if (result === null) {
          setPriceUnreachable(true);
        } else {
          setPurchasePrice(result.price.toString());
          setPriceSource(result.source);
        }
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [autoPrice, selectedCoin, purchaseDate, fetchNonce]);

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
      ...(editHolding?.order !== undefined ? { order: editHolding.order } : {}),
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

  const isValid =
    selectedCoin &&
    amount &&
    parseFloat(amount) > 0 &&
    purchasePrice &&
    parseFloat(purchasePrice) > 0 &&
    purchaseDate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {isEditing ? (
              <>
                <Pencil className="h-5 w-5 text-primary" />
                Edit holding
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-primary" />
                New holding
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="coin-search-input">Asset</Label>
            <CoinSearch
              onSelect={setSelectedCoin}
              value={
                isEditing
                  ? `${editHolding.coinName} (${editHolding.coinSymbol.toUpperCase()})`
                  : undefined
              }
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount-input">Quantity</Label>
              <Input
                id="amount-input"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.5"
                className="h-11 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-input">Purchase date</Label>
              <DatePicker
                id="date-input"
                value={isoToDate(purchaseDate)}
                onChange={(d) => d && setPurchaseDate(dateToIso(d))}
                disabled={(date) => date > new Date()}
              />
            </div>
          </div>

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
                      ? "Looking up the market close…"
                      : priceSource
                        ? `Auto-filled from ${priceSource}. Toggle off to override.`
                        : "Auto-fill will fetch when you pick a coin + date."
                    : "Manual entry — override the market price."}
                </p>
              </div>
              <Switch checked={autoPrice} onCheckedChange={setAutoPrice} />
            </div>

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
                  "h-11 rounded-xl font-mono pr-10",
                  autoPrice && !priceUnreachable && "bg-background/60"
                )}
              />
              {priceLoading && (
                <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {priceUnreachable && autoPrice && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-background/60 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Couldn't reach the price feeds — you can retry or type it in.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFetchNonce((n) => n + 1)}
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            )}
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
            {isEditing ? "Save changes" : "Add to ledger"}
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
