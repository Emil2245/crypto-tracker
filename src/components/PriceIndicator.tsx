import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TICK_MS = 30_000;

interface PriceIndicatorProps {
  lastUpdated: number | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function PriceIndicator({
  lastUpdated,
  loading,
  error,
  onRefresh,
}: PriceIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const stateColor = error
    ? "var(--loss)"
    : loading
      ? "var(--primary)"
      : "var(--gain)";

  return (
    <Button
      variant="outline"
      onClick={onRefresh}
      disabled={loading}
      aria-label="Refresh prices"
      id="refresh-prices-btn"
      className="h-10 gap-2 rounded-xl px-3.5 text-xs font-medium"
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: stateColor }}
        />
        {loading && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: stateColor, opacity: 0.5 }}
          />
        )}
      </span>
      <span className="text-muted-foreground">
        {error
          ? "Feed offline"
          : lastUpdated
            ? timeAgo(lastUpdated, now)
            : "Fetching…"}
      </span>
      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
    </Button>
  );
}

function timeAgo(ts: number, now: number): string {
  const seconds = Math.floor((now - ts) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
