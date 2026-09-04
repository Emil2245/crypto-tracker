# Screenshots

Screenshots are regenerated automatically on every push to `main` via [`.github/workflows/screenshots.yml`](../.github/workflows/screenshots.yml). The build runs with a seeded portfolio (`?seed` query param) containing 10 transactions across BTC, ETH, XRP, SOL, BNB, TRX, and ZEC. Playwright captures four views.

To regenerate locally:

```bash
bun run build
bun run screenshots
```

Output lands in `screenshots/`.

---

### Desktop — light

![Desktop light mode](../screenshots/ui-light.png)

### Desktop — dark

![Desktop dark mode](../screenshots/ui-dark.png)

### Mobile — light (390 × 844)

![Mobile light mode](../screenshots/ui-mobile-light.png)

### BTC transaction history

![BTC coin detail dialog](../screenshots/ui-btc-transactions.png)
