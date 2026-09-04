# Plan 010: Create PortfolioProvider context to eliminate prop-drilling

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/App.tsx src/components/PortfolioSummary.tsx src/components/HoldingsLedger.tsx src/components/AssetSidebar.tsx src/hooks/useHoldings.ts src/hooks/usePrices.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 006 (PositionRow memoization — do this plan after 006 to avoid merge conflicts on HoldingsLedger)
- **Category**: tech-debt
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

`App.tsx` prop-drills ~18 props to 3 children (`AssetSidebar`, `HoldingsLedger`, `PortfolioSummary`). A `PortfolioProvider` context makes the data flow explicit and eliminates the drilling. Each consumer uses `usePortfolio()` instead of receiving props individually. This also makes it easier to add new consumers without changing the App signature.

## Current state

- `src/App.tsx:16-112` — the App function body extracts data from hooks and passes props to children:
```typescript
function App() {
  const { holdings, getTransactions, addTransaction, updateTransaction, deleteCoin, reorderHoldings } = useHoldings();
  const { prices, loading, lastUpdated, error, refetch } = usePrices(holdings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => { ... });
  usePersistence();

  return (
    // ...
    <AssetSidebar holdings={holdings} prices={prices} selectedId={selectedId} onSelect={setSelectedId} collapsed={collapsed} onToggleCollapsed={...} onReorder={reorderHoldings} onAdd={addTransaction} />
    <PortfolioSummary holdings={holdings} prices={prices} loading={loading} onAdd={addTransaction} />
    <HoldingsLedger holdings={holdings} prices={prices} getTransactions={getTransactions} onAdd={addTransaction} onUpdateTransaction={updateTransaction} onDelete={deleteCoin} />
  );
}
```

Props drilled to consumers:
- `AssetSidebar`: holdings, prices, selectedId, onSelect, collapsed, onToggleCollapsed, onReorder, onAdd (8 props)
- `PortfolioSummary`: holdings, prices, loading, onAdd (4 props)
- `HoldingsLedger`: holdings, prices, getTransactions, onAdd, onUpdateTransaction, onDelete (6 props)

Total: ~18 prop assignments across 3 children.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/contexts/PortfolioContext.tsx` (create)
- `src/App.tsx` — wrap children in `<PortfolioProvider>`, remove prop drilling
- `src/components/AssetSidebar.tsx` — use `usePortfolio()` instead of props
- `src/components/HoldingsLedger.tsx` — use `usePortfolio()` instead of props
- `src/components/PortfolioSummary.tsx` — use `usePortfolio()` instead of props

**Out of scope**:
- `src/components/CoinDetailDialog.tsx`, `src/components/AddHoldingDialog.tsx`, `src/components/DeleteHoldingDialog.tsx` — these receive their own props (not from App), leave unchanged
- `src/components/PriceIndicator.tsx`, `src/components/ThemeToggle.tsx` — these receive simple props from App, leave unchanged
- No visual changes

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `refactor: create PortfolioProvider context to eliminate prop-drilling`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the PortfolioContext

Create `src/contexts/PortfolioContext.tsx`:

```typescript
import { createContext, useContext } from "react";
import type { Holding, TransactionInput } from "@/types";

export interface PortfolioContextValue {
  holdings: Holding[];
  prices: Record<string, number>;
  loading: boolean;
  lastUpdated: number | null;
  error: string | null;
  refetch: () => void;
  getTransactions: (coinId: string) => Promise<any[]>;
  onAdd: (transaction: TransactionInput) => void;
  onUpdateTransaction: (id: number, data: TransactionInput) => void;
  onDelete: (coinId: string) => Promise<void>;
  onReorder: (reordered: Holding[]) => void;
}

export const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within <PortfolioProvider>");
  return ctx;
}
```

**Verify**: `bun run build` → exit 0 (the new file is type-safe but not yet imported)

### Step 2: Wrap App children in PortfolioProvider

Edit `src/App.tsx`:

1. Import the context:
```typescript
import { PortfolioContext, type PortfolioContextValue } from "@/contexts/PortfolioContext";
```

2. Build a `portfolioValue` object inside the App function (after the hooks, before the return):
```typescript
const portfolioValue: PortfolioContextValue = {
  holdings,
  prices,
  loading,
  lastUpdated,
  error,
  refetch,
  getTransactions,
  onAdd: addTransaction,
  onUpdateTransaction: updateTransaction,
  onDelete: deleteCoin,
  onReorder: reorderHoldings,
};
```

3. Wrap the main content in the provider:
```typescript
return (
  <PortfolioContext.Provider value={portfolioValue}>
    <div className="min-h-screen text-foreground">
      {/* ... existing JSX, but REMOVE all props from AssetSidebar, HoldingsLedger, PortfolioSummary */}
    </div>
  </PortfolioContext.Provider>
);
```

4. Remove the drilled props from the three child components. For example:
- `<AssetSidebar holdings={holdings} prices={prices} ... />` → `<AssetSidebar />` (plus `selectedId`, `onSelect`, `collapsed`, `onToggleCollapsed` which are App-local state, not portfolio data — these stay as props)
- `<PortfolioSummary holdings={holdings} prices={prices} loading={loading} onAdd={addTransaction} />` → `<PortfolioSummary />`
- `<HoldingsLedger holdings={holdings} prices={prices} getTransactions={getTransactions} onAdd={addTransaction} onUpdateTransaction={updateTransaction} onDelete={deleteCoin} />` → `<HoldingsLedger />`

**Note**: `AssetSidebar` still receives `selectedId`, `onSelect`, `collapsed`, `onToggleCollapsed` as App-local state props. These are NOT portfolio data and should NOT go in the context.

**Verify**: `bun run build` → exit 0

### Step 3: Update AssetSidebar to use context

Edit `src/components/AssetSidebar.tsx`:

1. Update the props interface — remove `holdings`, `prices`, `onAdd`, `onReorder` from the props (keep `selectedId`, `onSelect`, `collapsed`, `onToggleCollapsed`)
2. Import `usePortfolio`:
```typescript
import { usePortfolio } from "@/contexts/PortfolioContext";
```
3. Inside the component, destructure from context:
```typescript
const { holdings, prices, onAdd, onReorder } = usePortfolio();
```
4. Remove those values from the component's props destructuring.

**Verify**: `bun run build` → exit 0

### Step 4: Update PortfolioSummary to use context

Edit `src/components/PortfolioSummary.tsx`:

1. Remove `holdings`, `prices`, `loading`, `onAdd` from the props interface
2. Import and use `usePortfolio`:
```typescript
import { usePortfolio } from "@/contexts/PortfolioContext";
// ...
const { holdings, prices, loading, onAdd } = usePortfolio();
```
3. The component now takes no props. Update the call site in App.tsx: `<PortfolioSummary />`

**Verify**: `bun run build` → exit 0

### Step 5: Update HoldingsLedger to use context

Edit `src/components/HoldingsLedger.tsx`:

1. Remove `holdings`, `prices`, `getTransactions`, `onAdd`, `onUpdateTransaction`, `onDelete` from the props interface
2. Import and use `usePortfolio`:
```typescript
import { usePortfolio } from "@/contexts/PortfolioContext";
// ...
const { holdings, prices, getTransactions, onAdd, onUpdateTransaction, onDelete } = usePortfolio();
```
3. The component now takes no props. Update the call site in App.tsx: `<HoldingsLedger />`

**Verify**: `bun run build` → exit 0

### Step 6: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors
**Verify**: `grep -rn "holdings=" src/App.tsx` → no matches inside JSX (props no longer drilled for portfolio data)

## Test plan

- No new test file needed — this is a structural refactor, not a behavior change
- Verification: `bun run build` passes, all three consumer components render identically
- Manual: open the app, verify holdings load, prices display, charts render, dialogs open

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `src/contexts/PortfolioContext.tsx` exists and exports `PortfolioContext`, `usePortfolio`
- [ ] `src/App.tsx` wraps content in `<PortfolioContext.Provider>`
- [ ] `grep -rn "holdings=" src/App.tsx` → no portfolio-data props in JSX (only App-local state like `selectedId`, `collapsed`)
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- TypeScript errors about missing context value properties.
- The visual output changes.

## Maintenance notes

- **Re-render optimization**: When `prices` changes (every 5 min via SWR), the `PortfolioContext.Provider` re-renders ALL consumers. If this causes performance issues, split the context into two: `PortfolioDataContext` (holdings, getTransactions) and `PriceContext` (prices, loading, lastUpdated, error, refetch). Price updates would only re-render price consumers.
- The `selectedId`, `onSelect`, `collapsed`, `onToggleCollapsed` props on `AssetSidebar` are App-local state — they intentionally stay as props because they're not shared portfolio data.
- Future consumers of portfolio data (e.g. a settings panel, an export feature) can use `usePortfolio()` without adding new props to App.
