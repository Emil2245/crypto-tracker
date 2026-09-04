# Data model

All data is stored in IndexedDB via [Dexie](https://dexie.org) in a database named `CryptoTrackerDB`. Nothing leaves the browser.

## Tables

### `transactions` (v3+)

The ledger. One row per purchase event.

| Field | Type | Notes |
|---|---|---|
| `id` | `number` (auto) | Dexie primary key |
| `coinId` | `string` | CoinGecko coin ID (e.g. `"bitcoin"`) |
| `coinName` | `string` | Display name at time of purchase |
| `coinSymbol` | `string` | Ticker at time of purchase (e.g. `"BTC"`) |
| `coinImage` | `string?` | CoinGecko thumbnail URL |
| `amount` | `number` | Units purchased |
| `purchasePrice` | `number` | USD price per unit at purchase |
| `purchaseDate` | `string` | `YYYY-MM-DD` |
| `createdAt` | `number` | Unix ms, set once on insert |
| `updatedAt` | `number` | Unix ms, updated on every edit |

Indexes: `coinId`, `purchaseDate`.

### `assetMeta` (v3+)

Per-coin sidebar metadata. One row per coin (keyed by `coinId`).

| Field | Type | Notes |
|---|---|---|
| `coinId` | `string` | Out-of-line primary key |
| `order` | `number?` | Sidebar sort rank; lower = earlier |

When a coin's first transaction is added, `assetMeta.put({ coinId, order: Date.now() })` guarantees a row exists. Drag-to-reorder replaces `order` with sequential integers (1, 2, 3, …) across all coins.

### `holdings` (v1–v2, legacy)

A flat single-row-per-coin table from before the transaction model. It still physically exists in any upgraded DB (Dexie cannot change an existing table's primary key, so it was left in place). It is never read or written after the v3 migration.

## Schema migrations

| Version | Change |
|---|---|
| v1 | Initial `holdings` table |
| v2 | Added `order` index to `holdings`; backfilled `order = createdAt` for existing rows |
| v3 | Added `transactions` + `assetMeta`; copied every legacy `holdings` row into `transactions` and its order into `assetMeta` |

## Derived type: `Holding`

`Holding` is never stored — it is computed from `transactions` on the fly inside `deriveHoldings()` (`src/hooks/useHoldings.ts`) and memoized by `useMemo`.

```
transactions (all rows for one coinId)
  → sum amounts
  → weighted-average purchasePrice  (totalCost / totalAmount)
  → earliest purchaseDate
  → most-recent coinName / coinSymbol / coinImage  (from newest tx)
  → transactionCount
  → order  (from assetMeta)
  = Holding
```

The `id` on a `Holding` is a stable numeric hash of `coinId` (djb2-style), used as a React list key.

## Calculations (`src/lib/calculations.ts`)

| Export | Formula |
|---|---|
| `initialValue(h)` | `amount × purchasePrice` |
| `currentValue(h, p)` | `amount × p` |
| `valueDifference(h, p)` | `currentValue − initialValue` |
| `pctChange(current, basis)` | `(current − basis) / basis` |
| `averageDailyChange(h, p)` | `valueDifference / daysSincePurchase` |

## Persistence

On mount `usePersistence` calls `navigator.storage.persist()`, requesting that the browser not evict the IndexedDB under storage pressure. The request is advisory; the browser may decline. Private-mode windows keep data only for the session.
