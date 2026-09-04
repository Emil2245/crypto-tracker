# Plan 006: Memoize PositionRow and stabilize callback props

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/components/HoldingsLedger.tsx src/hooks/useHoldings.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

Every 5-minute SWR price refresh causes `App` to re-render, which causes `HoldingsLedger` to re-render, which causes ALL `PositionRow` components to re-render — even rows whose `holding` and `price` props haven't changed. With 20 holdings this means ~120 component trees (2 layouts + 4 dialogs per row) re-rendering unnecessarily. Additionally, `PositionRow` creates new `addCoin`/`pickerCoin` objects on every render, which would defeat `React.memo` even if applied.

## Current state

- `src/components/HoldingsLedger.tsx:227` — `PositionRow` is a plain function component, not wrapped in `React.memo`
- `src/components/HoldingsLedger.tsx:285-297` — `addCoin` and `pickerCoin` are object literals recreated every render:
```typescript
const addCoin = {
  coinId: holding.coinId,
  coinName: holding.coinName,
  coinSymbol: holding.coinSymbol,
  coinImage: holding.coinImage,
};

const pickerCoin = {
  coinId: holding.coinId,
  coinName: holding.coinName,
  coinSymbol: holding.coinSymbol,
  coinImage: holding.coinImage,
};
```
- `src/hooks/useHoldings.ts` — exports `getTransactions`, `addTransaction`, `updateTransaction`, `deleteCoin`, `reorderHoldings`. These are regular functions (not wrapped in `useCallback`), so they create new references on every render.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/components/HoldingsLedger.tsx` — wrap `PositionRow` in `React.memo`, add `useMemo` for `addCoin`/`pickerCoin`
- `src/hooks/useHoldings.ts` — wrap exported functions in `useCallback`

**Out of scope**:
- `src/App.tsx` — do not change how props are passed to HoldingsLedger
- No visual changes to any component

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `perf: memoize PositionRow and stabilize callback props in useHoldings`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Wrap useHoldings callbacks in useCallback

In `src/hooks/useHoldings.ts`:

Wrap each exported function in `useCallback`. The functions are defined inside the hook and reference `db` (a stable module-level import). They don't depend on any React state, so `[]` is the correct dependency array for each.

For each function (e.g. `getTransactions`, `addTransaction`, `updateTransaction`, `deleteCoin`, `reorderHoldings`):

```typescript
// Before:
function getTransactions(coinId: string) {
  return db.transactions.where("coinId").equals(coinId).toArray();
}

// After:
const getTransactions = useCallback((coinId: string) => {
  return db.transactions.where("coinId").equals(coinId).toArray();
}, []);
```

Apply the same pattern to all 5 exported functions.

**Verify**: `bun run build` → exit 0

### Step 2: Memoize addCoin/pickerCoin in PositionRow

In `src/components/HoldingsLedger.tsx`, inside the `PositionRow` component, replace the plain object literals with `useMemo`:

```typescript
// Before:
const addCoin = { coinId: holding.coinId, coinName: holding.coinName, ... };

// After:
import { useMemo } from "react"; // add to existing import

const addCoin = useMemo(() => ({
  coinId: holding.coinId,
  coinName: holding.coinName,
  coinSymbol: holding.coinSymbol,
  coinImage: holding.coinImage,
}), [holding.coinId, holding.coinName, holding.coinSymbol, holding.coinImage]);

const pickerCoin = useMemo(() => ({
  coinId: holding.coinId,
  coinName: holding.coinName,
  coinSymbol: holding.coinSymbol,
  coinImage: holding.coinImage,
}), [holding.coinId, holding.coinName, holding.coinSymbol, holding.coinImage]);
```

**Verify**: `bun run build` → exit 0

### Step 3: Wrap PositionRow in React.memo

Find the `PositionRow` function definition (around line 227). Wrap it in `React.memo`:

```typescript
// Before:
function PositionRow({ holding, price, ... }: PositionRowProps) {
  // ... component body
}

// After:
const PositionRow = React.memo(function PositionRow({ holding, price, ... }: PositionRowProps) {
  // ... component body (unchanged)
});
```

Add `import React from "react"` at the top of the file (or add `memo` to the existing React import: `import React, { useMemo } from "react"`).

**Verify**: `bun run build` → exit 0

### Step 4: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors

## Test plan

- No new test file needed — this is a performance optimization, not a behavior change
- Verification: `bun run build` passes, visual output unchanged
- If a test runner is set up: existing component tests (if any) should still pass

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `grep -rn "useCallback" src/hooks/useHoldings.ts` → matches for all 5 exported functions
- [ ] `grep -rn "React.memo" src/components/HoldingsLedger.tsx` → at least 1 match
- [ ] `grep -rn "useMemo" src/components/HoldingsLedger.tsx` → at least 2 matches (addCoin, pickerCoin)
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The visual output of any component changes (regression in appearance).
- Wrapping in `useCallback` causes a TypeScript error about function types.

## Maintenance notes

- The `useCallback` wrappers in `useHoldings.ts` stabilize the function references so that `React.memo` on `PositionRow` can actually skip re-renders. Without stable callbacks, `React.memo` would be a no-op (new function references on every render cause re-renders anyway).
- If new functions are added to `useHoldings.ts`, they should also be wrapped in `useCallback` with `[]` dependencies (they reference only module-level `db`, not React state).
- The `useMemo` on `addCoin`/`pickerCoin` is only necessary because `PositionRow` is now memoized. If `PositionRow` were not memoized, the new object references wouldn't matter.
- Future: if `PositionRow` needs to be split into smaller sub-components, the memo boundary should move to the most granular re-render-sensitive subtree.
