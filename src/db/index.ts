import Dexie, { type Table } from "dexie";
import type { Holding } from "@/types";

class CryptoTrackerDB extends Dexie {
  holdings!: Table<Holding>;

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
        const rows = await tx.table<Holding>("holdings").toArray();
        for (const row of rows) {
          if (row.id !== undefined && row.order === undefined) {
            await tx
              .table<Holding>("holdings")
              .update(row.id, { order: row.createdAt });
          }
        }
      });
  }
}

export const db = new CryptoTrackerDB();
