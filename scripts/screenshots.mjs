import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { preview } from "vite";
import { mockCoinGecko } from "./mock-coingecko.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots");
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

const DESKTOP_VIEWPORT = { width: 1440, height: 1000 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const shots = {
  "ui-light.png": { viewport: DESKTOP_VIEWPORT, theme: "light" },
  "ui-dark.png": { viewport: DESKTOP_VIEWPORT, theme: "dark" },
  "ui-mobile-light.png": { viewport: MOBILE_VIEWPORT, theme: "light" },
};

/**
 * Waits until the PriceIndicator leaves "Fetching…" (prices resolved from live
 * APIs, or the mock fallback) and the chart has data. CoinGecko is hybrid
 * live-then-mock, so allow a generous budget then keep going anyway.
 */
async function waitForAppReady(page) {
  await page.waitForSelector("[role='button']", { state: "attached" });
  try {
    await page.waitForFunction(
      () => {
        const el = document.querySelector("#refresh-prices-btn");
        return el != null && !el.textContent.includes("Fetching");
      },
      null,
      { timeout: 60_000 }
    );
  } catch {
    // Prices stuck fetching — still capture layout, empty price cells included.
  }
  // Give the chart time to draw its line path (data fetch is serialized + slow).
  // The chart's data line is the only path with stroke-linecap="round".
  try {
    await page.waitForSelector("svg path[stroke-linecap='round']", {
      state: "visible",
      timeout: 60_000,
    });
  } catch {}
  await page.waitForTimeout(1500);
}

async function currentPriceIndicatorText(page) {
  return page.locator("#refresh-prices-btn").innerText();
}

let previewServer;
async function startPreview() {
  previewServer = await preview({ preview: { port: PORT, strictPort: true } });
  await waitForServer();
  return () => previewServer.close();
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("preview server did not start in time");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const stopServer = await startPreview();
  const browser = await chromium.launch();
  const cgStats = {};
  try {
    for (const [filename, { viewport, theme }] of Object.entries(shots)) {
      await capturePage(filename, viewport, theme, browser, cgStats);
    }
    await captureBtcTransactions(browser, cgStats);
  } finally {
    await browser.close();
    stopServer();
  }
  console.log(
    `Wrote ${Object.keys(shots).length + 1} screenshots to screenshots/  ` +
      `(CoinGecko: ${cgStats.live ?? 0} live, ${cgStats.mock ?? 0} mocked ${JSON.stringify(cgStats.byKind ?? {})})`
  );
}

/** One full-page screenshot of the whole app in the given viewport + theme. */
async function capturePage(filename, viewport, theme, browser, cgStats) {
  const page = await newPage(browser, theme, viewport, cgStats);
  try {
    await page.goto(`${BASE_URL}/?seed`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForAppReady(page);
    await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: true });
    console.log(`✔ ${filename}  (prices: ${await currentPriceIndicatorText(page)})`);
  } finally {
    await page.close();
  }
}

/** Opens the BTC CoinDetailDialog (3 buys) and captures it in light theme. */
async function captureBtcTransactions(browser, cgStats) {
  const page = await newPage(browser, "light", DESKTOP_VIEWPORT, cgStats);
  try {
    await page.goto(`${BASE_URL}/?seed`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await waitForAppReady(page);

    // The desktop ledger row for Bitcoin — scoped to the main column (the
    // sidebar has its own Bitcoin entry, avoid that one).
    const btcRow = page
      .locator("section")
      .getByRole("button")
      .filter({ hasText: /Bitcoin/ })
      .first();
    await btcRow.click();
    await page.waitForSelector('[data-slot="dialog-content"]', { state: "visible" });

    const dialog = page.locator('[data-slot="dialog-content"]');
    await dialog.screenshot({
      path: path.join(OUT_DIR, "ui-btc-transactions.png"),
    });
    console.log("✔ ui-btc-transactions.png  (BTC dialog, 3 buys)");
  } finally {
    await page.close();
  }
}

async function newPage(browser, theme, viewport, cgStats) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((t) => {
    localStorage.setItem("theme", t);
  }, theme);
  const page = await context.newPage();
  await mockCoinGecko(page, cgStats);
  return page;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});