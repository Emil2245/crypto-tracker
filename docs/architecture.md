# Architecture

## Entry point

`src/main.tsx` bootstraps the app. If the URL contains `?seed` it calls `seedPortfolio()` before mounting — this is how the CI screenshot workflow pre-populates the DB. The root is wrapped in `next-themes`'s `ThemeProvider` (class-based, default dark).

## Component tree

```
App
├── PortfolioProvider           (context, holds all portfolio state)
├── nav
│   ├── PriceIndicator          (last-updated label + refresh button)
│   └── ThemeToggle
├── EmptyState                  (shown when holdings.length === 0)
└── layout: AssetSidebar | main
    ├── AssetSidebar            (collapsible coin list, drag-to-reorder)
    │   ├── CoinMark            (avatar + symbol chip per coin)
    │   ├── AddHoldingDialog    (coin search → date/amount/price form)
    │   └── DeleteHoldingDialog
    └── main section
        ├── PortfolioSummary    (total value, gain/loss, chart)
        │   └── PortfolioChart  (Recharts line chart, 1D–1Y ranges)
        └── HoldingsLedger      (per-coin table)
            ├── SortHeader
            ├── ReturnBadge     (coloured gain/loss pill)
            └── CoinDetailDialog (transactions list + per-tx return)
                └── TransactionPickerDialog (edit/delete a tx)
```

## State and data flow

All live state lives in `App` and is published through `PortfolioContext` so every descendant can read it without prop-drilling.

```
useHoldings  ──► holdings[]        ─┐
usePrices    ──► prices{}          ─┤  PortfolioProvider
             ──► loading/error      ─┘       │
                                             ▼
                               every consumer via usePortfolio()
```

### `useHoldings` (`src/hooks/useHoldings.ts`)

Subscribes to the `transactions` and `assetMeta` Dexie tables via `useLiveQuery`. On any DB write the query re-runs reactively. Raw `Transaction[]` rows are reduced into a `Holding[]` by `deriveHoldings()`: amounts are summed per coin, cost basis is weighted-averaged, the earliest purchase date is kept. Sidebar order comes from `assetMeta.order`.

### `usePrices` (`src/hooks/usePrices.ts`)

Drives a SWR fetch keyed on the joined coin-ID list, refreshing every 5 minutes. Calls `getPricesWithFallback` — CoinGecko simple price first, Binance + Gate.io in parallel for any misses. See [price-fetching.md](./price-fetching.md).

### `usePortfolioHistory` (`src/hooks/usePortfolioHistory.ts`)

Drives a separate SWR fetch for the portfolio chart, refreshing every 15 minutes. Calls `getMarketChart` (CoinGecko `/market_chart`) for each coin sequentially (they go through the rate-limit queue), then `buildTimeline` aligns them onto a common timestamp grid using binary-search nearest-price interpolation. Coins with no history fall back to a flat line at the current (or purchase) price so the total stays honest.

## Layout

The outer container is a 1440 px max-width flex column. Below `lg` breakpoint (`1024 px`) the sidebar stacks above the main content. Above it the layout switches to a two-column CSS grid: `320px sidebar | minmax(0, 1fr) main`. When the sidebar is collapsed the first column shrinks to `76px` (icon-rail only); the transition is CSS `transition-[grid-template-columns]`.

Sidebar collapsed state is persisted to `localStorage` under the key `ledger:sidebarCollapsed`.

## Theme

`next-themes` toggles the `class="dark"` attribute on `<html>`. All colour tokens are CSS variables defined in `src/index.css` under `:root` (light) and `.dark` (dark). The purple primary accent is `oklch(0.6 0.18 280)`.
