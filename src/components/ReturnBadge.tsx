import { ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";

type ReturnBadgeProps = {
  diff: number;
  pct: number;
  size?: "small" | "compact" | "large";
  label?: string;
};

export function ReturnBadge({
  diff,
  pct,
  size = "small",
  label,
}: ReturnBadgeProps) {
  const isPositive = diff >= 0;
  const color = isPositive ? "var(--gain)" : "var(--loss)";
  const bg = isPositive ? "var(--gain-soft)" : "var(--loss-soft)";
  const iconClass = size === "compact" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <div
      data-testid="return-badge"
      className="inline-flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5"
      style={{ background: bg, color }}
    >
      {size === "large" ? (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: color }}
        >
          {isPositive ? (
            <ArrowUp className={iconClass} strokeWidth={3} />
          ) : (
            <ArrowDown className={iconClass} strokeWidth={3} />
          )}
        </span>
      ) : isPositive ? (
        <ArrowUp className={iconClass} strokeWidth={3} />
      ) : (
        <ArrowDown className={iconClass} strokeWidth={3} />
      )}
      <span className="font-mono tabular text-sm font-semibold">
        {isPositive ? "+" : ""}
        {formatCurrency(diff)}
      </span>
      <span className="opacity-40">·</span>
      <span className="font-mono tabular text-sm font-semibold">
        {isPositive ? "+" : ""}
        {(pct * 100).toFixed(2)}%
      </span>
      {label && (
        <span className="text-xs font-medium opacity-70">{label}</span>
      )}
    </div>
  );
}
