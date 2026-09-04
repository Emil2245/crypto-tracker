import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import type { Holding } from "@/types";

export function useHoldings() {
  const holdings = useLiveQuery(() => db.holdings.toArray()) ?? [];

  async function addHolding(
    holding: Omit<Holding, "id" | "createdAt" | "updatedAt">
  ) {
    const now = Date.now();
    await db.holdings.add({
      ...holding,
      order: holding.order ?? now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function updateHolding(
    id: number,
    updates: Partial<Omit<Holding, "id" | "createdAt">>
  ) {
    await db.holdings.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  async function deleteHolding(id: number) {
    await db.holdings.delete(id);
  }

  /**
   * Persist a new custom order. Accepts the holding IDs in the desired order;
   * every id gets an ascending `order` value so future adds land after them.
   */
  async function reorderHoldings(orderedIds: number[]) {
    await db.transaction("rw", db.holdings, async () => {
      const now = Date.now();
      await Promise.all(
        orderedIds.map((id, index) =>
          db.holdings.update(id, { order: index, updatedAt: now })
        )
      );
    });
  }

  return { holdings, addHolding, updateHolding, deleteHolding, reorderHoldings };
}
