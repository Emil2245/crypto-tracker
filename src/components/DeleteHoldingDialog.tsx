import { useEffect, useState } from "react";
import { useControlledOpen } from "@/hooks/useControlledOpen";
import { AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoinMark } from "@/components/CoinMark";
import {
  currentValue,
  daysSincePurchase,
  formatCurrency,
  initialValue,
  valueDifference,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import type { Holding } from "@/types";

interface DeleteHoldingDialogProps {
  holding: Holding;
  price?: number;
  onConfirm: () => void;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteHoldingDialog({
  holding,
  price,
  onConfirm,
  trigger,
  open: openProp,
  onOpenChange,
}: DeleteHoldingDialogProps) {
  const [open, setOpen] = useControlledOpen(openProp, onOpenChange);
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [typedSymbol, setTypedSymbol] = useState("");

  const expectedSymbol = holding.coinSymbol.toUpperCase();
  const typedMatches = typedSymbol.trim().toUpperCase() === expectedSymbol;
  const canDelete = ack1 && ack2 && typedMatches;

  // Reset the gates every time the dialog opens.
  useEffect(() => {
    if (!open) {
      setAck1(false);
      setAck2(false);
      setTypedSymbol("");
    }
  }, [open]);

  const day1 = initialValue(holding);
  const today = price ? currentValue(holding, price) : day1;
  const diff = price ? valueDifference(holding, price) : 0;
  const days = daysSincePurchase(holding);

  function handleConfirm() {
    if (!canDelete) return;
    onConfirm();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "var(--loss-soft)",
                color: "var(--loss)",
              }}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Delete {holding.coinName}?
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                This removes the position from your ledger permanently. There's
                no undo.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Summary of what's being deleted */}
        <div className="rounded-2xl bg-secondary/60 p-4">
          <div className="flex items-center gap-3">
            <CoinMark
              symbol={holding.coinSymbol}
              image={holding.coinImage}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {holding.coinName}
              </p>
              <p className="mt-0.5 font-mono tabular text-[0.72rem] font-medium text-muted-foreground">
                {holding.coinSymbol.toUpperCase()} · acquired{" "}
                {holding.purchaseDate} · {days}d held
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
            <SummaryStat label="Cost basis" value={formatCurrency(day1)} />
            <SummaryStat
              label="Current value"
              value={price ? formatCurrency(today) : "—"}
            />
            <SummaryStat
              label="Total return"
              value={price ? `${diff >= 0 ? "+" : ""}${formatCurrency(diff)}` : "—"}
              tone={price ? (diff >= 0 ? "gain" : "loss") : "neutral"}
            />
          </div>
        </div>

        {/* Gate 1 */}
        <Gate
          checked={ack1}
          onToggle={() => setAck1((v) => !v)}
          label="I understand this action can't be undone."
        />

        {/* Gate 2 */}
        <Gate
          checked={ack2}
          onToggle={() => setAck2((v) => !v)}
          label="I've noted or exported the cost basis and history if I still need them."
        />

        {/* Gate 3 — typed confirmation */}
        <div className="space-y-2">
          <label
            htmlFor="delete-symbol-confirm"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Type <span className="font-mono text-foreground">{expectedSymbol}</span>{" "}
            to confirm
          </label>
          <Input
            id="delete-symbol-confirm"
            value={typedSymbol}
            onChange={(e) => setTypedSymbol(e.target.value)}
            placeholder={expectedSymbol}
            className={cn(
              "h-11 rounded-xl font-mono uppercase tracking-wider",
              typedSymbol.length > 0 &&
                !typedMatches &&
                "border-[color:var(--loss)]"
            )}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-5 text-sm font-semibold"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete}
            onClick={handleConfirm}
            className={cn(
              "h-11 rounded-xl px-5 text-sm font-semibold",
              canDelete && "!bg-[color:var(--loss)] !text-white hover:!bg-[color:var(--loss)]/90"
            )}
            id={`confirm-delete-${holding.id}`}
          >
            Delete {holding.coinSymbol.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "gain" | "loss";
}) {
  const color =
    tone === "gain"
      ? "var(--gain)"
      : tone === "loss"
        ? "var(--loss)"
        : undefined;
  return (
    <div>
      <p className="text-[0.66rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-mono tabular text-sm font-bold"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

function Gate({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-3.5 text-left transition-colors hover:bg-secondary",
        checked && "border-primary/40 bg-accent-soft"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background"
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="text-sm font-medium leading-snug">{label}</span>
    </button>
  );
}
