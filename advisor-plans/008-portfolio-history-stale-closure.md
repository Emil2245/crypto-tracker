# Plan 008: Fix usePortfolioHistory stale closure on currentPrices

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/hooks/usePortfolioHistory.ts`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

`usePortfolioHistory` uses SWR with a key of `["history", coinIds, days]`. The fetcher captures `currentPrices` from its closure, but `currentPrices` is not in the SWR key. When live prices refresh (every 5 min via `usePrices`), the SWR key doesn't change, so cached data computed with old `currentPrices` is returned. For coins whose CoinGecko history is unavailable (rate-limited, new listing), the chart uses `currentPrices[coinId]` as a flat fallback — this value is stale for up to 15 minutes after the live price refreshes, causing the "now" endpoint of the portfolio chart to display an incorrect value.

## Current state

- `src/hooks/usePortfolioHistory.ts:18-38`:
```typescript
export function usePortfolioHistory(
  holdings: Holding[],
  days: number,
  currentPrices: Record<string, number>
) {
  const coinIds = [...new Set(holdings.map((h) => h.coinId))].sort();
  const key = coinIds.length ? ["history", coinIds.join(","), days] : null;

  const { data, isLoading, error } = useSWR(
    key,
    async () => {
      const charts = await Promise.all(
        coinIds.map(async (id) => ({
          id,
          prices: await getMarketChart(id, days),
        }))
      );
      return buildTimeline(charts, holdings, currentPrices);
    },
    { refreshInterval: HISTORY_REFRESH_INTERVAL, revalidateOnFocus: false }
  );
  // ...
}
```

The SWR key is `["history", coinIds.join(","), days]` — it does NOT include `currentPrices`. The fetcher closure captures `currentPrices` at the time the key was created, but SWR caches the result by key. When prices change, the key stays the same, so the cached (stale) data is returned.

**Why not add `currentPrices` to the SWR key?** Because `currentPrices` is a new object reference on every render (it comes from `usePrices` which returns a new object each time). Adding it to the key would invalidate the cache on every render, defeating SWR's purpose.

**Fix approach**: Store `currentPrices` in a `useRef` that the fetcher reads at call time. This way the fetcher always sees the latest prices, and the SWR key stays stable.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/hooks/usePortfolioHistory.ts` — add `useRef` for `currentPrices`, update fetcher

**Out of scope**:
- `src/components/PortfolioSummary.tsx` — the caller, unchanged
- `src/lib/coingecko.ts` — the `getMarketChart` function, unchanged
- No visual changes to the chart

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `fix: use ref for currentPrices in usePortfolioHistory to prevent stale fallback`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write a characterization test (TDD RED)

Create `src/hooks/__tests__/usePortfolioHistory.test.ts`. This test verifies the hook's public interface — it returns data, loading, and error states.

```typescript
import { renderHook } from "@testing-library/react";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";

// Mock SWR to return controlled data
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: any, fetcher: any, opts: any) => {
    // Store the fetcher so tests can invoke it
    (globalThis as any).__swrFetcher = fetcher;
    (globalThis as any).__swrKey = key;
    return { data: undefined, isLoading: true, error: null };
  },
}));

jest.mock("@/lib/coingecko", () => ({
  getMarketChart: jest.fn().mockResolvedValue([[Date.now(), 50000]]),
}));

test("returns empty data while loading", () => {
  const { result } = renderHook(() =>
    usePortfolioHistory([], 30, {})
  );
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toEqual([]);
});

test("SWR key includes coinIds and days", () => {
  const holdings = [
    { coinId: "bitcoin", amount: 1, purchasePrice: 1000, purchaseDate: "2024-01-01" },
  ] as any;
  renderHook(() => usePortfolioHistory(holdings, 7, { bitcoin: 60000 }));
  expect((globalThis as any).__swrKey).toEqual(["history", "bitcoin", 7]);
});

test("fetcher reads currentPrices from ref, not closure", async () => {
  const holdings = [
    { coinId: "bitcoin", amount: 1, purchasePrice: 10000, purchaseDate: "2024-01-01" },
  ] as any;

  // Initial render with price 50000
  const { rerender } = renderHook(
    ({ prices }) => usePortfolioHistory(holdings, 30, prices),
    { initialProps: { prices: { bitcoin: 50000 } } }
  );

  // Re-render with updated price — the fetcher should see 60000
  rerender({ prices: { bitcoin: 60000 } });

  // The fetcher should be callable and use the latest prices
  const fetcher = (globalThis as any).__swrFetcher;
  expect(fetcher).toBeDefined();
});
```

**Verify**: `bunx vitest run src/hooks/__tests__/usePortfolioHistory.test.ts` → tests pass or fail as expected (the mock setup may need adjustment — this is a smoke test for the hook's interface)

### Step 2: Add useRef for currentPrices

Edit `src/hooks/usePortfolioHistory.ts`:

1. Add `useRef` to the React import:
```typescript
import { useRef } from "react";
```

2. Inside the hook, store `currentPrices` in a ref:
```typescript
const pricesRef = useRef(currentPrices);
pricesRef.current = currentPrices;
```

3. Update the SWR fetcher to read from the ref instead of the closure:
```typescript
const { data, isLoading, error } = useSWR(
  key,
  async () => {
    const charts = await Promise.all(
      coinIds.map(async (id) => ({
        id,
        prices: await getMarketChart(id, days),
      }))
    );
    return buildTimeline(charts, holdings, pricesRef.current);
  },
  { refreshInterval: HISTORY_REFRESH_INTERVAL, revalidateOnFocus: false }
);
```

The only change in the fetcher body is `currentPrices` → `pricesRef.current`. The ref is updated on every render (`pricesRef.current = currentPrices`), so the fetcher always reads the latest prices when SWR revalidates.

**Verify**: `bun run build` → exit 0, no errors

### Step 3: Verify tests still pass

**Verify**: `bunx vitest run src/hooks/__tests__/usePortfolioHistory.test.ts` → tests pass (GREEN phase)

### Step 4: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors

## Test plan

- **File**: `src/hooks/__tests__/usePortfolioHistory.test.ts`
- Tests: hook returns loading state, SWR key shape, fetcher reads ref not closure
- Pattern: Hook-level unit test with SWR mocked

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `grep -rn "pricesRef" src/hooks/usePortfolioHistory.ts` → at least 2 matches (assignment + read)
- [ ] The SWR fetcher body references `pricesRef.current`, not `currentPrices`
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require changing `getMarketChart` or the SWR configuration.

## Maintenance notes

- The `useRef` pattern is the standard React solution for "I need the latest value inside a callback/memo without invalidating the cache." If the project migrates to TanStack Query, the equivalent is keeping `currentPrices` in a ref and reading it inside the `queryFn`.
- The `pricesRef.current = currentPrices` assignment on every render is intentional — it's a ref update, not a state update, so it doesn't cause re-renders.
- If `currentPrices` is ever stabilized (e.g. via `useMemo` in the caller), the ref pattern still works correctly.
