import { useState } from "react";
import { useControlledOpen } from "@/hooks/useControlledOpen";
import { ArrowRight, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CoinMark } from "@/components/CoinMark";
import { formatAmountCompact, formatCurrency } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

interface TransactionPickerDialogProps {
  coin: { coinId: string; coinName: string; coinSymbol: string; coinImage?: string };
  transactions: Transaction[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Fires once the user picks and confirms a transaction to edit. */
  onSelect: (transaction: Transaction) => void;
}

export function TransactionPickerDialog({
  coin,
  transactions,
  open: openProp,
  onOpenChange,
  onSelect,
}: TransactionPickerDialogProps) {
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange);
  const [pending, setPending] = useState<Transaction | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setPending(null);
    setOpen(next);
  }

  function confirm() {
    if (!pending) return;
    onSelect(pending);
    setPending(null);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CoinMark
              symbol={coin.coinSymbol}
              image={coin.coinImage}
              size={40}
            />
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Pencil className="h-5 w-5 text-primary" />
                Edit a transaction
              </DialogTitle>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                {coin.coinName} · {transactions.length}{" "}
                {transactions.length === 1 ? "buy" : "buys"} — choose which one
                to modify.
              </p>
            </div>
          </div>
        </DialogHeader>

        {pending ? (
          <div className="rounded-2xl bg-secondary/40 p-4">
            <p className="text-sm font-semibold tracking-tight">
              Edit this transaction?
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary px-4 py-3 font-mono tabular text-sm">
              <span className="text-muted-foreground">{pending.purchaseDate}</span>
              <span className="font-bold">
                {formatAmountCompact(pending.amount)} {coin.coinSymbol.toUpperCase()}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                You paid
              </span>
              <span className="font-mono tabular text-sm font-bold">
                {formatCurrency(pending.amount * pending.purchasePrice)}
              </span>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5 text-sm font-semibold"
                onClick={() => setPending(null)}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={confirm}
                className="h-11 gap-2 rounded-xl px-5 text-sm font-semibold"
                id={`confirm-edit-${pending.id}`}
              >
                <Pencil className="h-4 w-4" />
                Edit transaction
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[300px] overflow-y-auto rounded-2xl bg-secondary/40">
              <ul className="flex flex-col gap-0.5 p-1.5">
                {transactions.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setPending(t)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-secondary"
                      )}
                      id={`pick-transaction-${t.id}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tracking-tight">
                            {t.purchaseDate}
                          </p>
                          <p className="mt-0.5 font-mono tabular text-[0.7rem] font-medium text-muted-foreground">
                            {formatAmountCompact(t.amount)}{" "}
                            {coin.coinSymbol.toUpperCase()} @{" "}
                            {formatCurrency(t.purchasePrice)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono tabular text-sm font-bold">
                          {formatCurrency(t.amount * t.purchasePrice)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
