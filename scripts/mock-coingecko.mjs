/**
 * Hybrid live-then-mock CoinGecko interception for screenshot runs.
 *
 * Each api.coingecko.com request is first attempted against the real API via
 * route.fetch(). Headless Chromium often cannot reach CoinGecko (net::ERR_FAILED)
 * even though node can, which leaves the portfolio chart empty. When the live
 * request fails, we fulfill with a deterministic fixture instead, so the graph
 * always renders and screenshots stay stable in environments without CoinGecko
 * access.
 */

/** Fixed "current" USD prices for the 7 seeded coins (fallback + series end). */
export const FIXED_PRICES = {
  bitcoin: 105_000,
  ethereum: 3_400,
  ripple: 0.62,
  solana: 165,
  binancecoin: 640,
  tron: 0.16,
  zcash: 30,
};

/** Stable seeded PRNG so the generated series is identical every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A smooth 30-day series for one coin: an anchored multi-segment offset from
 * end-price that trails off, with per-step noise, so the chart line looks like
 * a real market chart rather than a straight line.
 */
function buildSeries(coinId, endPrice, points = 192) {
  const rand = mulberry32(seedFor(coinId));
  const now = Date.now();
  const stepMs = (30 * 24 * 60 * 60 * 1000) / (points - 1);

  // A few anchor offsets (as fractions of end price) that drift back toward 0
  // so the line wanders realistically but always ends at the current price.
  const anchors = [];
  let acc = 0.94;
  for (let i = 0; i < points; i += Math.floor(points / 4)) {
    acc = Math.max(0.8, Math.min(1.2, acc + (rand() - 0.5) * 0.08));
    anchors.push(acc);
  }

  return Array.from({ length: points }, (_, i) => {
    const frac = i / (points - 1);
    const seg = Math.floor(frac * (anchors.length - 1));
    const local = (frac * (anchors.length - 1)) - seg;
    const base =
      (anchors[seg] ?? 1) * (1 - local) + (anchors[seg + 1] ?? 1) * local;
    const noise = (rand() - 0.5) * 0.004 * base;
    const price = Math.max(0, endPrice * Math.max(0, base + noise));
    return [Math.round(now - (points - 1 - i) * stepMs), Number(price.toFixed(4))];
  });
}

function simplePriceFixture(path) {
  const url = new URL(path, "https://api.coingecko.com");
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const out = {};
  for (const id of ids) {
    const p = FIXED_PRICES[id];
    if (p !== undefined) out[id] = { usd: p };
  }
  return out;
}

function marketChartFixture(path) {
  const m = path.match(/\/coins\/([^/]+)\/market_chart/);
  if (!m) return null;
  const id = m[1];
  const price = FIXED_PRICES[id];
  if (price === undefined) return null;
  return { prices: buildSeries(id, price) };
}

function historyFixture(coinId) {
  const price = FIXED_PRICES[coinId];
  if (price === undefined) return null;
  return {
    market_data: { current_price: { usd: price } },
  };
}

/** Falls back to the mock fixture when the live API is unreachable. */
export async function mockCoinGecko(page, stats = {}) {
  await page.route("**/api.coingecko.com/**", async (route) => {
    const path = route.request().url();
    try {
      const response = await route.fetch({ timeout: 6000 });
      if (response.ok()) {
        stats.live = (stats.live ?? 0) + 1;
        await route.fulfill({ response });
        return;
      }
      throw new Error(`live status ${response.status()}`);
    } catch {
      stats.mock = (stats.mock ?? 0) + 1;
      const kind = path.includes("/simple/price")
        ? "simplePrice"
        : path.includes("/market_chart")
          ? "marketChart"
          : path.includes("/history")
            ? "history"
            : "other";
      stats.byKind = stats.byKind ?? {};
      stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
      let payload = null;
      if (path.includes("/simple/price")) {
        payload = simplePriceFixture(path);
      } else if (path.includes("/market_chart")) {
        payload = marketChartFixture(path) ?? { prices: [] };
      } else {
        const m = path.match(/\/coins\/([^/]+)\/history/);
        if (m) payload = historyFixture(m[1]) ?? null;
      }
      if (payload === null) {
        await route.abort();
        return;
      }
      await route.fulfill({ json: payload });
    }
  });
}