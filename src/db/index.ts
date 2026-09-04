import Dexie, { type Table } from "dexie";
import type { Transaction } from "@/types";

/**
 * Per-coin sidebar metadata. Keyed by coinId (out-of-line primary key). Only
 * the custom sort order lives here — everything else is derived from the
 * `transactions` table.
 */
export interface AssetMeta {
  coinId: string;
  order?: number;
}

/** Shape of a row in the legacy (pre-v3) flat `holdings` table. */
interface LegacyHolding {
  id: number;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage?: string;
  amount: number;
  purchasePrice: number;
  purchaseDate: string;
  order?: number;
  createdAt?: number;
  updatedAt?: number;
}

class CryptoTrackerDB extends Dexie {
  transactions!: Table<Transaction>;
  /** Sidebar sort-order metadata, one row per coin. */
  assetMeta!: Table<AssetMeta>;

  constructor() {
    super("CryptoTrackerDB");
    this.version(1).stores({
      holdings: "++id, coinId, purchaseDate",
    });
    // v2 adds `order` for custom sidebar sorting.
    this.version(2)
      .stores({
        holdings: "++id, coinId, purchaseDate, order",
      })
      .upgrade(async (tx) => {
        const rows = await tx.table<LegacyHolding>("holdings").toArray();
        for (const row of rows) {
          if (row.id !== undefined && row.order === undefined) {
            await tx
              .table<LegacyHolding>("holdings")
              .update(row.id, { order: row.createdAt });
          }
        }
      });
    // v3 introduces the transaction model. The legacy flat `holdings` rows are
    // copied into a brand-new `transactions` table, and a new `assetMeta` table
    // holds per-coin sort order. The legacy `holdings` table is left untouched
    // (Dexie cannot change an existing table's primary key) and simply becomes
    // unused going forward.
    this.version(3)
      .stores({
        transactions: "++id, coinId, purchaseDate",
        assetMeta: "coinId, order",
      })
      .upgrade(async (tx) => {
        const legacy = await tx.table<LegacyHolding>("holdings").toArray();
        for (const row of legacy) {
          const now = Date.now();
          await tx.table<Transaction>("transactions").add({
            coinId: row.coinId,
            coinName: row.coinName,
            coinSymbol: row.coinSymbol,
            coinImage: row.coinImage,
            amount: row.amount,
            purchasePrice: row.purchasePrice,
            purchaseDate: row.purchaseDate,
            createdAt: row.createdAt ?? now,
            updatedAt: row.updatedAt ?? now,
          });
          await tx.table<AssetMeta>("assetMeta").put({
            coinId: row.coinId,
            order: row.order ?? row.createdAt ?? now,
          });
        }
      });
  }
}

export const db = new CryptoTrackerDB();
