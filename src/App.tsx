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
import { Logo } from "@/components/icons/Logo";

const SIDEBAR_COLLAPSED_KEY = "ledger:sidebarCollapsed";

function App() {
  const {
    holdings,
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteCoin,
    reorderHoldings,
  } = useHoldings();
  const { prices, loading, lastUpdated, error, refetch } = usePrices(holdings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  usePersistence();

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-12 sm:px-8 sm:pt-6">
        {/* Top nav */}
        <nav className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm"
              style={{ background: "var(--primary)" }}
            >
              <Logo />
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
            <EmptyState onAdd={addTransaction} />
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-4 lg:grid lg:gap-6 transition-[grid-template-columns] duration-200",
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
              onAdd={addTransaction}
            />
            <section className="flex min-w-0 flex-col gap-4 lg:gap-6">
              <PortfolioSummary
                holdings={holdings}
                prices={prices}
                loading={loading}
                onAdd={addTransaction}
              />
              <HoldingsLedger
                holdings={holdings}
                prices={prices}
                getTransactions={getTransactions}
                onAdd={addTransaction}
                onUpdateTransaction={updateTransaction}
                onDelete={deleteCoin}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
