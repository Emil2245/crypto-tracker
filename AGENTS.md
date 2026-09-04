# Agent guide

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Dexie (IndexedDB), SWR, Bun.

## Commands

```bash
bun run dev          # dev server on :5173
bun run build        # tsc + vite build
bun run lint         # eslint
bun run test         # vitest
bun run screenshots  # Playwright screenshot capture (requires a build first)
```

## Project layout

```
src/
  App.tsx                   # root component, wires hooks → PortfolioProvider
  main.tsx                  # bootstrap, ?seed param, ThemeProvider
  types/index.ts            # Transaction, Holding, CoinSearchResult
  db/index.ts               # Dexie schema + migrations (v1→v3)
  db/seed.ts                # dev/test seed data (?seed)
  lib/
    coingecko.ts            # all price fetching + rate-limit queue
    calculations.ts         # pure math helpers (value, pct, format)
    utils.ts                # cn() tailwind helper
  hooks/
    useHoldings.ts          # live Dexie query → Holding[] derivation
    usePrices.ts            # SWR price poll (5 min)
    usePortfolioHistory.ts  # SWR chart history (15 min)
    usePersistence.ts       # navigator.storage.persist()
    useControlledOpen.ts    # controlled/uncontrolled dialog state
  contexts/
    PortfolioContext.tsx     # PortfolioProvider + usePortfolio()
  components/               # all UI; ui/ = headless primitives
docs/
  architecture.md
  data-model.md
  price-fetching.md
  screenshots.md
advisor-plans/              # improvement plan history (don't delete)
scripts/
  screenshots.mjs           # Playwright runner
  mock-coingecko.mjs        # intercepts CoinGecko in CI
.github/workflows/
  screenshots.yml           # auto-regenerates screenshots on push to main
```

## Key conventions

- **No prop-drilling.** All portfolio state (`holdings`, `prices`, mutations) goes through `PortfolioContext`. Add new shared state there; don't thread it as props.
- **Holdings are derived, never stored.** `Transaction[]` is the source of truth. `Holding` is computed by `deriveHoldings()` in `useHoldings`. Don't write to a holdings table.
- **CoinGecko calls must go through `enqueue()`.** Direct `fetch` calls to the CoinGecko API will race past the 1 req/1.5 s rate limit. All other APIs (Binance, Gate.io, Coinbase) may be called freely.
- **Historical price requires two-source agreement.** `getPriceOnDate` returns `null` unless two of the four providers agree within 0.5 %. Don't relax this — a single-source price can be stale or wrong.
- **Dexie schema changes need a version bump.** Add a `this.version(N)` block in `src/db/index.ts`. Never mutate an existing version's `.stores()` definition or `.upgrade()` handler.
- **Tailwind v4** — utility classes are generated from CSS source, not a config file. Don't add a `tailwind.config.*`.
- **Tests live next to the code** in `__tests__/` subdirectories. Use Vitest + jsdom. Mock Dexie with `fake-indexeddb`.

## Docs

- [Architecture](docs/architecture.md) — component tree, data flow, layout
- [Data model](docs/data-model.md) — DB schema, migrations, derived types
- [Price fetching](docs/price-fetching.md) — live + historical price cascade, rate limiting
- [Screenshots](docs/screenshots.md) — all four views, how to regenerate
