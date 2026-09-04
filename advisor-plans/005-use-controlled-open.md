# Plan 005: Extract useControlledOpen hook for dialog open-state boilerplate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/hooks/useControlledOpen.ts src/components/AddHoldingDialog.tsx src/components/DeleteHoldingDialog.tsx src/components/TransactionPickerDialog.tsx`
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

Three dialog components maintain identical 3-line boilerplate for dual controlled/uncontrolled open state. When one is modified (e.g. adding a reset-on-close), the others are likely missed. A shared hook eliminates this duplication and makes the pattern explicit.

## Current state

All three components contain this identical pattern:

```typescript
const [internalOpen, setInternalOpen] = useState(false);
const open = openProp ?? internalOpen;
const setOpen = onOpenChange ?? setInternalOpen;
```

Found at:
1. `src/components/AddHoldingDialog.tsx:57-59`
2. `src/components/DeleteHoldingDialog.tsx:40-42`
3. `src/components/TransactionPickerDialog.tsx:31-33`

**Note**: `CoinDetailDialog.tsx` uses a different pattern (`const open = openProp ?? false; const setOpen = onOpenChange ?? (() => {})`) because it's always controlled — it does NOT have internal state. Do NOT include it in this refactor.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/hooks/useControlledOpen.ts` (create)
- `src/components/AddHoldingDialog.tsx` — replace 3-line pattern with hook call
- `src/components/DeleteHoldingDialog.tsx` — replace 3-line pattern with hook call
- `src/components/TransactionPickerDialog.tsx` — replace 3-line pattern with hook call

**Out of scope**:
- `src/components/CoinDetailDialog.tsx` — uses a different pattern (always controlled), not a candidate
- No changes to dialog behavior or visual output

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `refactor: extract useControlledOpen hook for dialog open-state`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write tests for the hook (TDD RED)

Create `src/hooks/__tests__/useControlledOpen.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { useControlledOpen } from "@/hooks/useControlledOpen";

test("starts closed when no props provided", () => {
  const { result } = renderHook(() => useControlledOpen());
  expect(result.current[0]).toBe(false);
});

test("opens and closes internally", () => {
  const { result } = renderHook(() => useControlledOpen());
  act(() => result.current[1](true));
  expect(result.current[0]).toBe(true);
  act(() => result.current[1](false));
  expect(result.current[0]).toBe(false);
});

test("uses openProp when provided (controlled)", () => {
  const { result } = renderHook(() => useControlledOpen(true));
  expect(result.current[0]).toBe(true);
});

test("calls onOpenChange when provided (controlled)", () => {
  const onOpenChange = jest.fn();
  const { result } = renderHook(() => useControlledOpen(false, onOpenChange));
  act(() => result.current[1](true));
  expect(onOpenChange).toHaveBeenCalledWith(true);
  // Internal state should NOT change — onOpenChange handles it
  expect(result.current[0]).toBe(false);
});

test("openProp overrides internal state", () => {
  const { result, rerender } = renderHook(
    ({ open }) => useControlledOpen(open),
    { initialProps: { open: false } }
  );
  act(() => result.current[1](true));
  expect(result.current[0]).toBe(true);
  rerender({ open: false });
  expect(result.current[0]).toBe(false);
});
```

**Verify**: `bunx vitest run src/hooks/__tests__/useControlledOpen.test.ts` → all tests FAIL (RED phase)

### Step 2: Create the hook

Create `src/hooks/useControlledOpen.ts`:

```typescript
import { useState } from "react";

export function useControlledOpen(
  openProp?: boolean,
  onOpenChange?: (open: boolean) => void
) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return [open, setOpen] as const;
}
```

**Verify**: `bunx vitest run src/hooks/__tests__/useControlledOpen.test.ts` → all tests pass (GREEN phase)

### Step 3: Replace AddHoldingDialog pattern

In `src/components/AddHoldingDialog.tsx`:
1. Add `import { useControlledOpen } from "@/hooks/useControlledOpen";`
2. Replace lines 57-59:
```typescript
// Before:
const [internalOpen, setInternalOpen] = useState(false);
const open = openProp ?? internalOpen;
const setOpen = onOpenChange ?? setInternalOpen;

// After:
const [open, setOpen] = useControlledOpen(openProp, onOpenChange);
```
3. Remove `useState` from the React import if it's no longer used (check if other `useState` calls exist in the file — they likely do, so keep `useState` imported).

**Verify**: `bun run build` → exit 0

### Step 4: Replace DeleteHoldingDialog pattern

In `src/components/DeleteHoldingDialog.tsx`:
1. Add `import { useControlledOpen } from "@/hooks/useControlledOpen";`
2. Replace lines 40-42 with `const [open, setOpen] = useControlledOpen(openProp, onOpenChange);`
3. Check if `useState` is still needed (likely yes, for other state).

**Verify**: `bun run build` → exit 0

### Step 5: Replace TransactionPickerDialog pattern

In `src/components/TransactionPickerDialog.tsx`:
1. Add `import { useControlledOpen } from "@/hooks/useControlledOpen";`
2. Replace lines 31-33 with `const [open, setOpen] = useControlledOpen(openProp, onOpenChange);`
3. Check if `useState` is still needed.

**Verify**: `bun run build` → exit 0

### Step 6: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors
**Verify**: `bunx vitest run src/hooks/__tests__/useControlledOpen.test.ts` → all tests pass

## Test plan

- **File**: `src/hooks/__tests__/useControlledOpen.test.ts`
- Tests: uncontrolled (open/close), controlled (openProp), controlled (onOpenChange callback), openProp override
- Pattern: hook-level unit tests via `renderHook`

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `bunx vitest run src/hooks/__tests__/useControlledOpen.test.ts` — all tests pass
- [ ] `grep -rn "openProp ?? internalOpen" src/components/` → no matches (all 3 replaced)
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching CoinDetailDialog.tsx (it uses a different pattern — do not include it).

## Maintenance notes

- This hook is simple and self-contained. If a dialog needs additional open-state behavior (e.g. animation callbacks, focus trapping), the hook can be extended without changing its API.
- CoinDetailDialog is intentionally excluded — its always-controlled pattern is semantically different and would need a separate hook variant if desired.
