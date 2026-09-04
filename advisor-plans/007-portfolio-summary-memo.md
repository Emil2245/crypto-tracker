# Plan 007: Memoize PortfolioSummary aggregations with useMemo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/components/PortfolioSummary.tsx`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

`PortfolioSummary` runs 4 separate `.reduce()` calls over `holdings` on every render, even when only `rangeIdx` (the chart range selector) changed. With 20 holdings, that's ~80 iterations per render. Wrapping these in `useMemo` keyed on `[holdings, prices]` skips recomputation when the inputs haven't changed.

## Current state

- `src/components/PortfolioSummary.tsx:43-63` — four `.reduce()` calls computed inline in the function body:
```typescript
const totalInvested = holdings.reduce((sum, h) => sum + initialValue(h), 0);
const totalCurrent = holdings.reduce((sum, h) => {
  const p = prices[h.coinId];
  return sum + (p ? currentValue(h, p) : initialValue(h));
}, 0);
const totalDiff = holdings.reduce((sum, h) => {
  const p = prices[h.coinId];
  return sum + (p ? valueDifference(h, p) : 0);
}, 0);
const pctChange = totalInvested > 0 ? totalDiff / totalInvested : 0;
const isPositive = totalDiff >= 0;

const todayDelta = deriveTodayDelta(history.data);

const avgPerDay = holdings.reduce((sum, h) => {
  const p = prices[h.coinId];
  return sum + (p ? averageDailyChange(h, p) : 0);
}, 0);

const dollars = Math.floor(totalCurrent);
const cents = (totalCurrent - dollars).toFixed(2).slice(2);
```

All of these depend only on `holdings` and `prices` (except `todayDelta` which depends on `history.data`). The derived `dollars`, `cents`, `pctChange`, `isPositive`, `avgPerDay` all flow from `totalInvested`, `totalCurrent`, `totalDiff`.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/components/PortfolioSummary.tsx` — wrap aggregations in `useMemo`

**Out of scope**:
- No changes to `usePortfolioHistory` or other hooks
- No visual changes

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `perf: memoize PortfolioSummary aggregations with useMemo`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add useMemo import

In `src/components/PortfolioSummary.tsx`, add `useMemo` to the React import:

```typescript
import { useState, useMemo } from "react";
```

### Step 2: Wrap aggregations in useMemo

Replace the inline computation block (lines 43-63) with:

```typescript
const { totalInvested, totalCurrent, totalDiff, pctChangeVal, isPositive, avgPerDay, dollars, cents } = useMemo(() => {
  const ti = holdings.reduce((sum, h) => sum + initialValue(h), 0);
  const tc = holdings.reduce((sum, h) => {
    const p = prices[h.coinId];
    return sum + (p ? currentValue(h, p) : initialValue(h));
  }, 0);
  const td = holdings.reduce((sum, h) => {
    const p = prices[h.coinId];
    return sum + (p ? valueDifference(h, p) : 0);
  }, 0);
  const pct = ti > 0 ? td / ti : 0;
  const pos = td >= 0;
  const apd = holdings.reduce((sum, h) => {
    const p = prices[h.coinId];
    return sum + (p ? averageDailyChange(h, p) : 0);
  }, 0);
  const d = Math.floor(tc);
  const c = (tc - d).toFixed(2).slice(2);
  return {
    totalInvested: ti,
    totalCurrent: tc,
    totalDiff: td,
    pctChangeVal: pct,
    isPositive: pos,
    avgPerDay: apd,
    dollars: d,
    cents: c,
  };
}, [holdings, prices]);
```

Note: renamed `pctChange` to `pctChangeVal` to avoid conflict with any existing variable name. Update all references in the JSX from `pctChange` to `pctChangeVal`.

### Step 3: Verify no visual changes

**Verify**: `bun run build` → exit 0, no errors

### Step 4: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors

## Test plan

- No new test file needed — this is a performance optimization, not a behavior change
- Verification: `bun run build` passes, visual output unchanged

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `grep -rn "useMemo" src/components/PortfolioSummary.tsx` → at least 1 match
- [ ] No `.reduce()` calls appear outside the `useMemo` block
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The visual output changes.

## Maintenance notes

- The `useMemo` dependency array `[holdings, prices]` is correct because all derived values flow from these two inputs. If a future change adds a new dependency (e.g. a user setting), it must be added to the array.
- `todayDelta` depends on `history.data` and is NOT included in this useMemo — it stays as a separate computation.
- If `holdings` is a new array reference on every render (e.g. from Dexie's `useLiveQuery`), the useMemo won't help. In that case, the caller must stabilize the `holdings` reference (e.g. with `useMemo` in `useHoldings`).
