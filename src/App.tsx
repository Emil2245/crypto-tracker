import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useHoldings } from "@/hooks/useHoldings";
import { usePrices } from "@/hooks/usePrices";
import { usePersistence } from "@/hooks/usePersistence";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { HoldingsLedger } from "@/components/HoldingsLedger";
import { AssetSidebar } from "@/components/AssetSidebar";
import { PriceIndicator } from "@/components/PriceIndicator";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Holding } from "@/types";

const SIDEBAR_COLLAPSED_KEY = "ledger:sidebarCollapsed";

function App() {
  const { holdings, addHolding, updateHolding, deleteHolding, reorderHoldings } =
    useHoldings();
  const { prices, loading, lastUpdated, error, refetch } = usePrices(holdings);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  usePersistence();

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  function handleUpdate(
    id: number,
    data: Omit<Holding, "id" | "createdAt" | "updatedAt">
  ) {
    updateHolding(id, data);
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-6 pt-6 pb-12 sm:px-8">
        {/* Top nav */}
        <nav className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm"
              style={{ background: "var(--primary)" }}
            >
              <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden>
                <path
                  d="M50 16 L84 50 L50 84 L16 50 Z"
                  fill="none"
                  stroke="white"
                  strokeWidth="7"
                  strokeLinejoin="round"
                />
                <path d="M50 16 L84 50 L50 84 Z" fill="white" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">Ledger</p>
              <p className="text-[0.7rem] font-medium text-muted-foreground">
                Private portfolio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PriceIndicator
              lastUpdated={lastUpdated}
              loading={loading}
              error={error}
              onRefresh={refetch}
            />
            <ThemeToggle />
          </div>
        </nav>

        {holdings.length === 0 ? (
          <div className="pt-8 sm:pt-16">
            <EmptyState onAdd={addHolding} />
          </div>
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 gap-6 transition-[grid-template-columns] duration-200",
              collapsed
                ? "lg:grid-cols-[76px_minmax(0,1fr)]"
                : "lg:grid-cols-[320px_minmax(0,1fr)]"
            )}
          >
            <AssetSidebar
              holdings={holdings}
              prices={prices}
              selectedId={selectedId}
              onSelect={setSelectedId}
              collapsed={collapsed}
              onToggleCollapsed={() => setCollapsed((c) => !c)}
              onReorder={reorderHoldings}
              onAdd={addHolding}
            />
            <section className="flex min-w-0 flex-col gap-6">
              <PortfolioSummary
                holdings={holdings}
                prices={prices}
                loading={loading}
                onAdd={addHolding}
              />
              <HoldingsLedger
                holdings={holdings}
                prices={prices}
                onUpdate={handleUpdate}
                onDelete={deleteHolding}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
