# Plan 004: Extract shared ReturnBadge component from 5 duplicated copies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/components/ReturnBadge.tsx src/components/CoinDetailDialog.tsx src/components/HoldingsLedger.tsx src/components/PortfolioSummary.tsx src/components/DeleteHoldingDialog.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

The "return badge" — a pill showing gain/loss with an arrow icon, signed dollar amount, and signed percentage — is duplicated 5 times across 3 files (CoinDetailDialog, HoldingsLedger mobile + desktop, PortfolioSummary, DeleteHoldingDialog). Each copy has slightly different sizing and layout. When the badge style, rounding, or color scheme changes, all 5 must be updated in lockstep. One copy has already drifted (PortfolioSummary uses inline `style` while others use CSS variable references).

## Current state

Five near-identical badge blocks:

1. **CoinDetailDialog.tsx:115-139** — small pill badge, ArrowUp/ArrowDown icons (h-3 w-3), font-mono tabular text-sm
2. **HoldingsLedger.tsx:379-400** (mobile) — compact badge, ArrowUp/ArrowDown (h-3.5 w-3.5), font-mono text-xs
3. **HoldingsLedger.tsx:456-475** (desktop) — same as mobile
4. **PortfolioSummary.tsx:90-119** — large badge, ArrowUp/ArrowDown (h-3 w-3), with "since acquisition" label, icon inside a circle
5. **DeleteHoldingDialog.tsx:116-127** — small badge, ArrowUp/ArrowDown (h-3 w-3), font-mono text-sm

All compute the same values: `diff` (dollar difference), `pct` (percent change), `isPositive` (direction). The differences are:
- **Size**: small (h-3 icons) vs compact (h-3.5 icons) vs large (h-3 with circle container)
- **Extra content**: PortfolioSummary adds "since acquisition" label and a dot separator
- **Color**: all use `var(--gain)` / `var(--loss)` / `var(--gain-soft)` / `var(--loss-soft)` but PortfolioSummary sometimes uses inline `style` instead of CSS variable references

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/components/ReturnBadge.tsx` (create)
- `src/components/CoinDetailDialog.tsx` — replace badge block with `<ReturnBadge>`
- `src/components/HoldingsLedger.tsx` — replace 2 badge blocks with `<ReturnBadge>`
- `src/components/PortfolioSummary.tsx` — replace badge block with `<ReturnBadge>`
- `src/components/DeleteHoldingDialog.tsx` — replace badge block with `<ReturnBadge>`

**Out of scope**:
- Do not change the visual appearance of any badge — the shared component must render identically to each original
- Do not touch `StatCard`, `Stat`, `MobileStat`, or any other stat-display components

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `refactor: extract shared ReturnBadge component from 5 duplicated copies`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write tests for the new component (TDD RED)

Create `src/components/__tests__/ReturnBadge.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { ReturnBadge } from "@/components/ReturnBadge";

test("renders gain with plus sign and green color", () => {
  render(<ReturnBadge diff={100} pct={0.5} />);
  expect(screen.getByText("+$100.00")).toBeInTheDocument();
  expect(screen.getByText("+50.00%")).toBeInTheDocument();
  const badge = screen.getByTestId("return-badge");
  expect(badge).toHaveStyle({ color: "var(--gain)" });
});

test("renders loss without plus sign", () => {
  render(<ReturnBadge diff={-50} pct={-0.25} />);
  expect(screen.getByText("-$50.00")).toBeInTheDocument();
  expect(screen.getByText("-25.00%")).toBeInTheDocument();
});

test("renders zero as non-negative", () => {
  render(<ReturnBadge diff={0} pct={0} />);
  expect(screen.getByText("$0.00")).toBeInTheDocument();
  expect(screen.getByText("0.00%")).toBeInTheDocument();
});

test("size=compact uses smaller icons", () => {
  const { container } = render(<ReturnBadge diff={100} pct={0.5} size="compact" />);
  const svg = container.querySelector("svg");
  expect(svg?.classList.contains("h-3.5")).toBe(true);
});

test("size=large shows icon in circle container", () => {
  const { container } = render(<ReturnBadge diff={100} pct={0.5} size="large" />);
  const circle = container.querySelector(".rounded-full.bg-\\(--gain\\)");
  expect(circle).toBeInTheDocument();
});

test("label prop adds trailing text", () => {
  render(<ReturnBadge diff={100} pct={0.5} label="since acquisition" />);
  expect(screen.getByText("since acquisition")).toBeInTheDocument();
});
```

**Verify**: `bunx vitest run src/components/__tests__/ReturnBadge.test.tsx` → all tests FAIL (RED phase, component doesn't exist)

### Step 2: Create the ReturnBadge component

Create `src/components/ReturnBadge.tsx`:

```typescript
import { ArrowUp, ArrowDown } from "lucide-react";

interface ReturnBadgeProps {
  diff: number;
  pct: number;
  size?: "small" | "compact" | "large";
  label?: string;
}

export function ReturnBadge({ diff, pct, size = "small", label }: ReturnBadgeProps) {
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
      ) : (
        isPositive ? (
          <ArrowUp className={iconClass} strokeWidth={3} />
        ) : (
          <ArrowDown className={iconClass} strokeWidth={3} />
        )
      )}
      <span className="font-mono tabular text-sm font-semibold">
        {isPositive ? "+" : ""}{`$${Math.abs(diff).toFixed(2)}`}
      </span>
      <span className="opacity-40">·</span>
      <span className="font-mono tabular text-sm font-semibold">
        {isPositive ? "+" : ""}{(pct * 100).toFixed(2)}%
      </span>
      {label && (
        <span className="text-xs font-medium opacity-70">{label}</span>
      )}
    </div>
  );
}
```

**Verify**: `bunx vitest run src/components/__tests__/ReturnBadge.test.tsx` → all tests pass (GREEN phase)

### Step 3: Replace CoinDetailDialog badge (lines 115-139)

In `src/components/CoinDetailDialog.tsx`:
1. Add `import { ReturnBadge } from "@/components/ReturnBadge";`
2. Remove the `import { ArrowUp, ArrowDown } from "lucide-react"` (no longer needed — ReturnBadge imports them)
3. Replace the entire badge `<div>` block (lines ~115-139) with:
```tsx
<ReturnBadge diff={diff} pct={pct} size="small" />
```

**Verify**: `bun run build` → exit 0

### Step 4: Replace HoldingsLedger mobile badge (lines 379-400)

In `src/components/HoldingsLedger.tsx`:
1. Add `import { ReturnBadge } from "@/components/ReturnBadge";`
2. Remove `ArrowUp, ArrowDown` from the lucide-react import (keep `Pencil, Plus, Trash2, Menu` etc.)
3. Replace the mobile badge block with `<ReturnBadge diff={diff} pct={pct} size="compact" />`

**Verify**: `bun run build` → exit 0

### Step 5: Replace HoldingsLedger desktop badge (lines 456-475)

Replace the desktop badge block with `<ReturnBadge diff={diff} pct={pct} size="compact" />`

**Verify**: `bun run build` → exit 0

### Step 6: Replace PortfolioSummary badge (lines 90-119)

In `src/components/PortfolioSummary.tsx`:
1. Add `import { ReturnBadge } from "@/components/ReturnBadge";`
2. Remove `ArrowUp, ArrowDown` from the lucide-react import
3. Replace the badge block with:
```tsx
<ReturnBadge diff={totalDiff} pct={pctChange} size="large" label="since acquisition" />
```
Note: the variable name in PortfolioSummary is `pctChange` (a `const`), not `pct`.

**Verify**: `bun run build` → exit 0

### Step 7: Replace DeleteHoldingDialog badge (lines 116-127)

In `src/components/DeleteHoldingDialog.tsx`:
1. Add `import { ReturnBadge } from "@/components/ReturnBadge";`
2. Remove `ArrowUp, ArrowDown` from the lucide-react import
3. Replace the badge block with `<ReturnBadge diff={diff} pct={pct} size="small" />`

**Verify**: `bun run build` → exit 0

### Step 8: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors
**Verify**: `bunx vitest run src/components/__tests__/ReturnBadge.test.tsx` → all tests pass
**Verify**: `grep -rn "ArrowUp\|ArrowDown" src/components/CoinDetailDialog.tsx src/components/PortfolioSummary.tsx src/components/DeleteHoldingDialog.tsx` → no matches (lucide imports removed from all 3)

## Test plan

- **File**: `src/components/__tests__/ReturnBadge.test.tsx`
- Tests: gain rendering, loss rendering, zero, size variants, label prop
- Integration: `bun run build` passes after each consumer replacement

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `bunx vitest run src/components/__tests__/ReturnBadge.test.tsx` — all tests pass
- [ ] `grep -rn "ArrowUp\|ArrowDown" src/components/` — only appears in `HoldingsLedger.tsx` (if still needed for other uses) and the new `ReturnBadge.tsx`
- [ ] No inline badge markup (pill with arrow + signed currency + %) remains in the 4 consumer files
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The visual output of any badge changes (regression in appearance).

## Maintenance notes

- The `ReturnBadge` component is a pure presentational component — it receives computed values and renders them. It does not compute `diff`, `pct`, or `isPositive` itself; callers pass those values.
- If the badge design changes (new icon, different rounding, color scheme), only `ReturnBadge.tsx` needs updating.
- The `size` prop controls icon size and container styling. If a new size variant is needed, add it to the `ReturnBadgeProps` type and the component.
