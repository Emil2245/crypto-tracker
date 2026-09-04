import { db } from "@/db";
import type { TransactionInput } from "@/types";

const DATES = ["2024-02-17", "2025-03-10", "2026-01-01"];

interface SeedCoin {
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage?: string;
  amounts: number[];
}

/**
 * 10 seed transactions across 7 assets, always the same coins in the same
 * relative order. The buy dates cycle through DATES: a coin with N buys uses
 * the first N dates (BTC = all 3, ETH = first 2, the rest = the first).
 */
export const SEED_ASSETS: SeedCoin[] = [
  {
    coinId: "bitcoin",
    coinName: "Bitcoin",
    coinSymbol: "BTC",
    coinImage:
      "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
    amounts: [0.5, 0.4, 0.25],
  },
  {
    coinId: "ethereum",
    coinName: "Ethereum",
    coinSymbol: "ETH",
    coinImage:
      "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png",
    amounts: [3, 2.5],
  },
  {
    coinId: "ripple",
    coinName: "XRP",
    coinSymbol: "XRP",
    coinImage:
      "https://assets.coingecko.com/coins/images/44/thumb/xrp-symbol-white-128.png",
    amounts: [1200],
  },
  {
    coinId: "solana",
    coinName: "Solana",
    coinSymbol: "SOL",
    coinImage:
      "https://assets.coingecko.com/coins/images/4128/thumb/solana.png",
    amounts: [40],
  },
  {
    coinId: "binancecoin",
    coinName: "BNB",
    coinSymbol: "BNB",
    coinImage:
      "https://assets.coingecko.com/coins/images/825/thumb/bnb-icon2_2x.png",
    amounts: [3],
  },
  {
    coinId: "tron",
    coinName: "TRON",
    coinSymbol: "TRX",
    coinImage:
      "https://assets.coingecko.com/coins/images/1094/thumb/tron-logo.png",
    amounts: [15000],
  },
  {
    coinId: "zcash",
    coinName: "Zcash",
    coinSymbol: "ZEC",
    coinImage:
      "https://assets.coingecko.com/coins/images/486/thumb/circle-zcash-color.png",
    amounts: [25],
  },
];

/** Rough "cost basis" per asset, used only to produce sane day-one numbers. */
const SEED_PRICES: Record<string, number[]> = {
  bitcoin: [45210, 83210, 98870],
  ethereum: [2945, 2160],
  ripple: [0.51],
  solana: [112.4],
  binancecoin: [324.7],
  tron: [0.118],
  zcash: [22.9],
};

export function buildSeedTransactions(): TransactionInput[] {
  const txs: TransactionInput[] = [];
  for (const coin of SEED_ASSETS) {
    const prices = SEED_PRICES[coin.coinId] ?? [];
    coin.amounts.forEach((amount, i) => {
      txs.push({
        coinId: coin.coinId,
        coinName: coin.coinName,
        coinSymbol: coin.coinSymbol,
        coinImage: coin.coinImage,
        amount,
        purchasePrice: prices[i] ?? 0,
        purchaseDate: DATES[i],
      });
    });
  }
  return txs;
}

/** Wipes the ledger and fills it with the standard 10-transaction seed. */
export async function seedPortfolio(): Promise<void> {
  await db.transaction("rw", db.transactions, db.assetMeta, async () => {
    await db.transactions.clear();
    await db.assetMeta.clear();

    let now = Date.now() - 365 * 24 * 60 * 60 * 1000;
    for (const tx of buildSeedTransactions()) {
      await db.transactions.add({ ...tx, createdAt: now, updatedAt: now });
      now += 60_000;
    }

    await db.assetMeta.bulkPut(
      SEED_ASSETS.map((coin, i) => ({ coinId: coin.coinId, order: i + 1 }))
    );
  });
}