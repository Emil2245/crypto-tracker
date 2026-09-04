# Plan 002: Hoist Intl.NumberFormat allocators to module scope

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/lib/calculations.ts`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

`formatCurrency` constructs a new `Intl.NumberFormat` on every call. Each `PositionRow` calls it ~6 times. With 10 holdings and a 5-minute price refresh, that's ~60 constructor calls per tick. `Intl.NumberFormat` is one of the heavier built-in objects to construct. Hoisting to module scope eliminates this entirely — `Intl.NumberFormat` is immutable and thread-safe.

## Current state

- `src/lib/calculations.ts` — the shared calculation module. Lines 31-61:
```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value);
}

export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}
```

Three functions, each constructing `Intl.NumberFormat` inside the function body. `formatPercent` is currently unused but should still be hoisted (it's exported and may be used in the future — or deleted in plan 009).

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/lib/calculations.ts`

**Out of scope**:
- Any consumer files — the function signatures and return values are unchanged
- `src/lib/calculations.ts` tests (created in plan 003 or separately)

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `perf: hoist Intl.NumberFormat allocators to module scope`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write characterization tests (TDD RED)

Create `src/lib/__tests__/calculations.test.ts`:

```typescript
import { formatCurrency, formatPercent, formatCompact, formatAmountCompact } from "@/lib/calculations";

describe("formatCurrency", () => {
  test("formats positive USD values", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });
  test("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
  test("formats negative values", () => {
    expect(formatCurrency(-99.9)).toBe("-$99.90");
  });
});

describe("formatCompact", () => {
  test("formats large values with 2 decimals", () => {
    expect(formatCompact(1234.56)).toBe("1,234.56");
  });
  test("formats small crypto values with more decimals", () => {
    const result = formatCompact(0.00001234);
    expect(result).toContain("0.0000");
  });
});

describe("formatPercent", () => {
  test("formats with sign display", () => {
    expect(formatPercent(0.1234)).toContain("12.34");
  });
});

describe("formatAmountCompact", () => {
  test("formats millions", () => {
    expect(formatAmountCompact(1_500_000)).toBe("1.50M");
  });
  test("formats thousands", () => {
    expect(formatAmountCompact(12_500)).toBe("12.5k");
  });
  test("formats small values", () => {
    expect(formatAmountCompact(0.001)).toContain("0.001");
  });
});
```

**Verify**: `bunx vitest run src/lib/__tests__/calculations.test.ts` → all tests pass. (Install vitest if needed: `bun add -D vitest`)

### Step 2: Hoist the formatters to module scope

Edit `src/lib/calculations.ts`. Add these constants at the top of the file, after the imports:

```typescript
const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PCT_FMT = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
});

const COMPACT_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_DETAIL_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});
```

Then replace the function bodies:

```typescript
export function formatCurrency(value: number): string {
  return USD_FMT.format(value);
}

export function formatPercent(value: number): string {
  return PCT_FMT.format(value);
}

export function formatCompact(value: number): string {
  return Math.abs(value) >= 1
    ? COMPACT_FMT.format(value)
    : COMPACT_DETAIL_FMT.format(value);
}
```

Leave `formatAmountCompact` unchanged — it uses `toLocaleString` and `.toFixed`, not `Intl.NumberFormat`.

**Verify**: `bun run build` → exit 0, no errors

### Step 3: Verify tests still pass (TDD GREEN)

**Verify**: `bunx vitest run src/lib/__tests__/calculations.test.ts` → all tests pass

### Step 4: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors

## Test plan

- **File**: `src/lib/__tests__/calculations.test.ts`
- Tests cover `formatCurrency`, `formatPercent`, `formatCompact`, `formatAmountCompact`
- Each test exercises the public function interface (output string format)
- Tests survive internal refactor (they don't care that the formatter is hoisted)

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `bunx vitest run src/lib/__tests__/calculations.test.ts` — all tests pass
- [ ] No `new Intl.NumberFormat` appears inside any function body in `calculations.ts`
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- vitest setup fails.

## Maintenance notes

- If new formatting functions are added to `calculations.ts`, they should also hoist their `Intl.NumberFormat` to module scope.
- `formatPercent` is currently unused (dead code) — plan 009 removes it. This plan hoists it anyway to keep the file consistent.
