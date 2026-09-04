# Plan 003: Extract shared pctChange helper to eliminate duplicated division-by-zero guards

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/lib/calculations.ts src/components/AssetSidebar.tsx src/components/PortfolioSummary.tsx src/components/CoinDetailDialog.tsx src/components/HoldingsLedger.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

The "percent change from cost basis" calculation `(current - basis) / basis` appears 5+ times with slightly different variable names, each guarding against division-by-zero independently. A missing guard is a subtle bug. Extracting a single `pctChange` helper standardizes the guard and eliminates the duplication.

## Current state

Inline expressions found at:

1. `src/components/AssetSidebar.tsx:149-151` — `(cur - initialValue(holding)) / initialValue(holding)`
2. `src/components/AssetSidebar.tsx:365-367` — identical expression
3. `src/components/PortfolioSummary.tsx:52` — `totalInvested > 0 ? totalDiff / totalInvested : 0`
4. `src/components/CoinDetailDialog.tsx:62` — `invested > 0 ? diff / invested : 0`
5. `src/components/HoldingsLedger.tsx:249` — `diff / day1` (where `day1 = initialValue(h)`)

Each site independently computes `initialValue` (or equivalent), then divides. Some guard `basis > 0`, others don't. A single helper standardizes this.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/lib/calculations.ts` — add `pctChange` function
- `src/components/AssetSidebar.tsx` — replace 2 inline expressions
- `src/components/PortfolioSummary.tsx` — replace 1 inline expression
- `src/components/CoinDetailDialog.tsx` — replace 1 inline expression
- `src/components/HoldingsLedger.tsx` — replace 1 inline expression

**Out of scope**:
- No new files needed
- Do not change any component's layout or visual output — this is a pure logic extraction

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `refactor: extract shared pctChange helper for percent-from-basis calculation`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write characterization tests (TDD RED)

Add to `src/lib/__tests__/calculations.test.ts` (create the file first if plan 002 hasn't run yet):

```typescript
import { pctChange } from "@/lib/calculations";

describe("pctChange", () => {
  test("returns positive ratio for gains", () => {
    expect(pctChange(200, 100)).toBeCloseTo(1.0); // 100% gain
  });
  test("returns negative ratio for losses", () => {
    expect(pctChange(50, 100)).toBeCloseTo(-0.5); // 50% loss
  });
  test("returns 0 when basis is 0", () => {
    expect(pctChange(100, 0)).toBe(0);
  });
  test("returns 0 when both are 0", () => {
    expect(pctChange(0, 0)).toBe(0);
  });
});
```

**Verify**: `bunx vitest run src/lib/__tests__/calculations.test.ts` → `pctChange` tests FAIL (function doesn't exist yet). This is expected — RED phase.

### Step 2: Add pctChange to calculations.ts

Add to `src/lib/calculations.ts`, after the existing functions and before the formatters:

```typescript
export function pctChange(diff: number, basis: number): number {
  return basis > 0 ? diff / basis : 0;
}
```

**Verify**: `bunx vitest run src/lib/__tests__/calculations.test.ts` → all tests pass (GREEN phase)

### Step 3: Replace inline expressions in AssetSidebar

In `src/components/AssetSidebar.tsx`:
1. Add `import { pctChange } from "@/lib/calculations"` (merge with existing calculations import)
2. Find the first inline expression at ~line 149: `(cur - initialValue(holding)) / initialValue(holding)`. Replace with `pctChange(cur - initialValue(holding), initialValue(holding))`
3. Find the second inline expression at ~line 365: same pattern. Replace with `pctChange(...)` using the same logic.

**Verify**: `bun run build` → exit 0

### Step 4: Replace inline expression in PortfolioSummary

In `src/components/PortfolioSummary.tsx`:
1. Add `pctChange` to the existing `@/lib/calculations` import
2. Replace line 52: `totalInvested > 0 ? totalDiff / totalInvested : 0` → `pctChange(totalDiff, totalInvested)`

**Verify**: `bun run build` → exit 0

### Step 5: Replace inline expression in CoinDetailDialog

In `src/components/CoinDetailDialog.tsx`:
1. Add `pctChange` to the existing `@/lib/calculations` import
2. Replace line ~62: `invested > 0 ? diff / invested : 0` → `pctChange(diff, invested)`

**Verify**: `bun run build` → exit 0

### Step 6: Replace inline expression in HoldingsLedger

In `src/components/HoldingsLedger.tsx`:
1. Add `pctChange` to the existing `@/lib/calculations` import
2. At ~line 249, `diff / day1` — replace with `pctChange(diff, day1)`. Also update the `day1` variable: if `day1` is `initialValue(h)`, the variable is already the basis, so the call is `pctChange(diff, day1)`.

**Verify**: `bun run build` → exit 0

### Step 7: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors
**Verify**: `bunx vitest run src/lib/__tests__/calculations.test.ts` → all tests pass
**Verify**: `grep -rn "(. - initialValue\|totalDiff / totalInvested\|diff / invested\|diff / day1" src/components/` → no matches (all inline expressions replaced)

## Test plan

- **File**: `src/lib/__tests__/calculations.test.ts`
- `pctChange` tests: gain, loss, zero-basis, both-zero
- Integration verification: `bun run build` passes after each file edit

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `bunx vitest run src/lib/__tests__/calculations.test.ts` — all tests pass
- [ ] `grep -rn "pctChange" src/components/` shows at least 4 import sites
- [ ] No inline `(x - y) / y` division-by-zero patterns remain in the 5 in-scope files
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If new components need percent-from-basis, they should use `pctChange` from `@/lib/calculations` instead of inlining the division.
- The zero-basis guard (`basis > 0 ? diff / basis : 0`) is the single source of truth now — if the product wants different zero-basis behavior (e.g. return `NaN`), only this one function needs to change.
