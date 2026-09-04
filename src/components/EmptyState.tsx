import { Wallet, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AddHoldingDialog } from "@/components/AddHoldingDialog";
import type { TransactionInput } from "@/types";

interface EmptyStateProps {
  onAdd: (transaction: TransactionInput) => void;
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <Card className="soft-card mx-auto max-w-2xl gap-8 px-10 py-14 text-center">
      <CardContent className="flex flex-col items-center gap-8 p-0">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: "var(--accent-soft)",
            color: "var(--primary)",
          }}
        >
          <Wallet className="h-7 w-7" strokeWidth={1.75} />
        </div>

        <div>
          <h3 className="text-3xl font-bold tracking-[-0.02em]">
            Your ledger is empty.
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Add your first holding to start tracking cost basis, live valuation
            and daily drift.
          </p>
        </div>

        <AddHoldingDialog onSubmit={onAdd} />

        <ul className="grid w-full grid-cols-3 gap-4 border-t border-border pt-8">
          <Feature icon={<Zap className="h-4 w-4" />} label="Live prices" />
          <Feature icon={<ShieldCheck className="h-4 w-4" />} label="Kept offline" />
          <Feature icon={<Wallet className="h-4 w-4" />} label="Yours alone" />
        </ul>
      </CardContent>
    </Card>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex flex-col items-center gap-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary"
        style={{ color: "var(--primary)" }}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </li>
  );
}
