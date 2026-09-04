# Plan 001: Fix CoinSearch async race condition

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/components/CoinSearch.tsx`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

When a user types quickly into the coin search, the debounce fires only the final query — but if two searches resolve out of order (e.g. a slow "bi" resolves after a fast "bitcoin"), stale results briefly flash in the dropdown. The fix is a standard request-counter pattern that discards stale responses.

## Current state

- `src/components/CoinSearch.tsx` — the search component. Lines 24-36:
```typescript
const search = useCallback(async (q: string) => {
  if (q.length < 2) {
    setResults([]);
    setIsOpen(false);
    return;
  }
  setLoading(true);
  const coins = await searchCoins(q);
  setResults(coins);
  setLoading(false);
  setIsOpen(coins.length > 0);
  setSelectedIdx(-1);
}, []);
```

The `search` callback awaits `searchCoins(q)` then unconditionally calls `setResults(coins)`. No check discards the result if a newer search was initiated after the await began.

- The debounce effect (lines 38-44) clears and restarts a `setTimeout` on each `query` change, firing `search(query)` after 350ms.
- `searchCoins` is imported from `@/lib/coingecko` and makes a network request.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/components/CoinSearch.tsx`

**Out of scope**:
- `src/lib/coingecko.ts` — the `searchCoins` function itself is fine
- No new files needed — the fix is purely internal to CoinSearch

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `fix: discard stale CoinSearch results on rapid typing`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write a characterization test (TDD RED)

Create `src/components/__tests__/CoinSearch.test.tsx`. This test captures the current behavior — when a single search resolves, results appear. This is the tracer bullet that proves the component renders correctly before you change anything.

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoinSearch } from "@/components/CoinSearch";
import * as coingecko from "@/lib/coingecko";

jest.mock("@/lib/coingecko");

test("shows results after search resolves", async () => {
  const mockSearch = jest.spyOn(coingecko, "searchCoins");
  mockSearch.mockResolvedValueOnce([
    { id: "bitcoin", name: "Bitcoin", symbol: "btc", thumb: "" },
  ]);

  const onSelect = jest.fn();
  render(<CoinSearch onSelect={onSelect} />);

  const input = screen.getByRole("textbox");
  await userEvent.type(input, "bit");

  await waitFor(() => {
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  });

  mockSearch.mockRestore();
});
```

**Verify**: `bunx vitest run src/components/__tests__/CoinSearch.test.tsx` → test passes. If vitest is not installed, install it first: `bun add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event` and add `"test": "vitest"` to package.json scripts if missing. (Stop and report if vitest setup fails — the plan depends on a working test runner.)

### Step 2: Add a request-counter to discard stale responses

Edit `src/components/CoinSearch.tsx`. Add a `useRef<number>` counter and check it after the await:

At the top of the component, after the existing `useRef` declarations (line 22), add:
```typescript
const requestIdRef = useRef(0);
```

Replace the `search` callback (lines 24-36) with:
```typescript
const search = useCallback(async (q: string) => {
  if (q.length < 2) {
    setResults([]);
    setIsOpen(false);
    return;
  }
  setLoading(true);
  const myRequest = ++requestIdRef.current;
  const coins = await searchCoins(q);
  if (myRequest !== requestIdRef.current) return; // stale — discard
  setResults(coins);
  setLoading(false);
  setIsOpen(coins.length > 0);
  setSelectedIdx(-1);
}, []);
```

The only change is two lines: `const myRequest = ++requestIdRef.current;` before the await, and `if (myRequest !== requestIdRef.current) return;` after it.

**Verify**: `bun run build` → exit 0, no errors

### Step 3: Write a race-condition regression test (TDD GREEN)

Add a second test to `src/components/__tests__/CoinSearch.test.tsx` that verifies stale results are discarded:

```typescript
test("discards stale results when a newer search is in flight", async () => {
  const mockSearch = jest.spyOn(coingecko, "searchCoins");

  // First call (slow) — resolves after the second
  let resolveFirst!: (value: any) => void;
  mockSearch.mockImplementationOnce(
    () => new Promise((r) => (resolveFirst = r))
  );
  // Second call (fast) — resolves first
  mockSearch.mockResolvedValueOnce([
    { id: "ethereum", name: "Ethereum", symbol: "eth", thumb: "" },
  ]);

  const onSelect = jest.fn();
  render(<CoinSearch onSelect={onSelect} />);

  const input = screen.getByRole("textbox");

  // Type "bi" → fires first search
  await userEvent.type(input, "bi", { delay: 10 });
  // Type "eth" → fires second search (debounce restarts)
  await userEvent.type(input, "eth", { delay: 10 });

  // Let the debounce fire and the fast response resolve
  await waitFor(() => {
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
  });

  // Now resolve the slow "bi" search — should NOT overwrite
  resolveFirst([
    { id: "bitcoin", name: "Bitcoin", symbol: "btc", thumb: "" },
  ]);

  // Wait a tick for the stale resolve to be processed
  await new Promise((r) => setTimeout(r, 50));

  // Results should still be Ethereum, not Bitcoin
  expect(screen.getByText("Ethereum")).toBeInTheDocument();
  expect(screen.queryByText("Bitcoin")).not.toBeInTheDocument();

  mockSearch.mockRestore();
});
```

**Verify**: `bunx vitest run src/components/__tests__/CoinSearch.test.tsx` → both tests pass

### Step 4: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors, none in CoinSearch

## Test plan

- **File**: `src/components/__tests__/CoinSearch.test.tsx`
- **Test 1**: "shows results after search resolves" — happy path, single search
- **Test 2**: "discards stale results when a newer search is in flight" — race condition regression
- **Pattern**: Integration-style, tests behavior through public DOM interface, not internal state

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `bunx vitest run src/components/__tests__/CoinSearch.test.tsx` — 2 tests pass
- [ ] No files outside `src/components/CoinSearch.tsx` and `src/components/__tests__/CoinSearch.test.tsx` are modified
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts (codebase has drifted).
- vitest setup fails (test runner is a prerequisite for this plan).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The `requestIdRef` pattern is a standard idiom for async deduplication in React. If CoinSearch is ever refactored to use a data-fetching library (SWR, TanStack Query), the built-in deduplication would make this manual counter unnecessary.
- The two tests serve as regression coverage for the race condition and the happy path.
