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
import { getPriceOnDate, PRICE_PROVIDERS, type PriceProvider } from "@/lib/coingecko";
import { formatCurrency } from "@/lib/calculations";
import type { CoinSearchResult, Holding } from "@/types";
import { Check, Loader2, Pencil, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SourceStatus = "pending" | "ok" | "empty";

function initialSourceStatus(): Record<PriceProvider, SourceStatus> {
  return Object.fromEntries(
    PRICE_PROVIDERS.map((p) => [p, "pending"])
  ) as Record<PriceProvider, SourceStatus>;
}

interface AddHoldingDialogProps {
  onSubmit: (
    holding: Omit<Holding, "id" | "createdAt" | "updatedAt">
  ) => void;
  editHolding?: Holding;
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
  editHolding,
  trigger,
  open: openProp,
  onOpenChange,
}: AddHoldingDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
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
  const [priceAttempt, setPriceAttempt] = useState(0);
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<Record<PriceProvider, SourceStatus>>(
    initialSourceStatus
  );

  const isEditing = !!editHolding;

  // Auto-fetch the market price for the selected coin + date. Every failed
  // pass through all three sources triggers a backoff retry (3s, then 4.5s,
  // 6.75s… capped at 30s) — the effect doesn't give up until it gets a price,
  // the user flips the toggle off, or the dialog closes.
  useEffect(() => {
    if (!autoPrice || !selectedCoin || !purchaseDate) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function tryFetch() {
      if (cancelled) return;
      setPriceLoading(true);
      setSourceStatus(initialSourceStatus());
      const result = await getPriceOnDate(
        selectedCoin!.id,
        selectedCoin!.symbol,
        purchaseDate,
        (provider, price) => {
          if (cancelled) return;
          setSourceStatus((prev) => ({
            ...prev,
            [provider]: price !== null ? "ok" : "empty",
          }));
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
      {(trigger || !isEditing) && (
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

            {autoPrice && selectedCoin && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PRICE_PROVIDERS.map((provider) => {
                  const status = sourceStatus[provider];
                  return (
                    <span
                      key={provider}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
                        status === "ok" &&
                          "bg-[color:var(--gain-soft)] text-[color:var(--gain)]",
                        status === "empty" &&
                          "bg-secondary text-muted-foreground",
                        status === "pending" &&
                          "bg-secondary text-muted-foreground"
                      )}
                    >
                      {status === "pending" && priceLoading ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : status === "ok" ? (
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      ) : (
                        <X className="h-2.5 w-2.5 opacity-50" />
                      )}
                      {provider}
                    </span>
                  );
                })}
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
