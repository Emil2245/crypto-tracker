# Price fetching

All price logic lives in `src/lib/coingecko.ts`.

## Live prices (current portfolio value)

`getPricesWithFallback(coinIds, symbolsByCoin)` runs on mount and every 5 minutes.

1. **CoinGecko** `simple/price` — primary source; returns all tracked coins in one call.
2. **Binance** `ticker/price` + **Gate.io** `spot/tickers` — queried in parallel for any coin CoinGecko didn't return. Binance has better coverage for majors; Gate.io covers more altcoins and doesn't require a key.

CryptoCompare was removed: its free `/pricemulti` endpoint now requires an API key and returns 401 on every call.

## Historical prices (purchase-date auto-fill)

`getPriceOnDate(coinId, coinSymbol, isoDate, onProgress?)` is called when the user adds a holding and leaves the price field on auto. It queries **four sources in parallel** and requires at least two to agree before returning a value.

| Source | Endpoint |
|---|---|
| CoinGecko | `/coins/{id}/history?date=DD-MM-YYYY` |
| Binance | `/api/v3/klines` (1d candle, close price) |
| Coinbase Exchange | `/products/{SYM-USD}/candles` (86400 s granularity) |
| Gate.io | `/spot/candlesticks` (1d interval) |

**Agreement rule:** two prices agree when `|a − b| / max(a, b) ≤ 0.005` (0.5 %). The returned value is their average; the source string (`"CoinGecko + Binance"`) is shown in the UI as a trust indicator.

If fewer than two sources corroborate, `getPriceOnDate` returns `null` — the caller shows an error and lets the user enter the price manually.

`onProgress` fires as each provider settles, so `AddHoldingDialog` can show per-source status in real time (tick or cross per provider) rather than an opaque spinner.

## Portfolio history (chart)

`getMarketChart(coinId, days)` calls CoinGecko `/coins/{id}/market_chart`. CoinGecko auto-selects granularity from the `days` parameter (≤1 → hourly, ≤90 → daily, >90 → weekly).

`usePortfolioHistory` calls this for each held coin through the rate-limit queue, then `buildTimeline` merges the results:

- The coin with the most data points sets the timestamp grid.
- Each other coin's price at each grid timestamp is found via binary search (nearest point, not interpolated).
- Coins with no history at all fall back to a flat line at `currentPrices[id] ?? purchasePrice`, so the total doesn't collapse to zero if one chart call fails.

## Rate limiting

CoinGecko's public (no-key) tier allows roughly one request per 1–2 seconds. `coingecko.ts` enforces this with a serial promise queue:

- Every CoinGecko call goes through `enqueue()`.
- `enqueue` chains each call onto the previous one; the next call waits until at least `MIN_INTERVAL` (1500 ms) has elapsed since the last.
- A caller's failure (`catch`) is swallowed from the queue so a single 429 doesn't block all subsequent calls.
- On a 429 response the request automatically retries once after a 5-second backoff.

Binance, Coinbase, and Gate.io are called directly without queueing (they have more generous free tiers and are only hit for fallback or historical lookups).
