import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Holding, Transaction, TransactionInput } from "@/types";
import { db, type AssetMeta } from "@/db";

/** Stable fallbacks so the derived `holdings` memo only recomputes on real data changes. */
const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_META: AssetMeta[] = [];

export function useHoldings() {
  const transactions =
    useLiveQuery(() => db.transactions.toArray()) ?? EMPTY_TRANSACTIONS;
  const metaByCoin =
    useLiveQuery(() => db.assetMeta.toArray()) ?? EMPTY_META;

  const metaMap = useMemo(() => {
    const map = new Map<string, AssetMeta>();
    for (const m of metaByCoin) map.set(m.coinId, m);
    return map;
  }, [metaByCoin]);

  const holdings = useMemo<Holding[]>(
    () => deriveHoldings(transactions, metaMap),
    [transactions, metaMap]
  );

  /** All transactions for a coin, newest first. */
  const getTransactions = useCallback(async (coinId: string): Promise<Transaction[]> => {
    const rows = await db.transactions.where("coinId").equals(coinId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, []);

  const addTransaction = useCallback(async (tx: TransactionInput) => {
    const now = Date.now();
    await db.transactions.add({
      ...tx,
      createdAt: now,
      updatedAt: now,
    });
    // Guarantee a metadata row exists (sets the initial sidebar order too).
    await db.assetMeta.put({ coinId: tx.coinId, order: now });
  }, []);

  const updateTransaction = useCallback(async (
    id: number,
    updates: Partial<Omit<Transaction, "id" | "createdAt">>
  ) => {
    await db.transactions.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  }, []);

  /** Removes every transaction for a coin, plus its sidebar metadata row. */
  const deleteCoin = useCallback(async (coinId: string) => {
    await db.transaction("rw", db.transactions, db.assetMeta, async () => {
      await db.transactions.where("coinId").equals(coinId).delete();
      await db.assetMeta.delete(coinId);
    });
  }, []);

  /**
   * Persist a new custom order. Accepts the coinIds in the desired order;
   * every id gets an ascending `order` value so future adds land after them.
   */
  const reorderHoldings = useCallback(async (orderedCoinIds: string[]) => {
    await db.transaction("rw", db.assetMeta, async () => {
      await Promise.all(
        orderedCoinIds.map((coinId, index) =>
          db.assetMeta.update(coinId, { order: index + 1 })
        )
      );
    });
  }, []);

  return {
    holdings,
    transactions,
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteCoin,
    reorderHoldings,
  };
}

function deriveHoldings(
  transactions: Transaction[],
  metaMap: Map<string, AssetMeta>
): Holding[] {
  const byCoin = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = byCoin.get(t.coinId) ?? [];
    list.push(t);
    byCoin.set(t.coinId, list);
  }

  const result: Holding[] = [];
  for (const [coinId, rows] of byCoin) {
    let totalAmount = 0;
    let totalCost = 0;
    let earliestDate = "";
    let createdAt = Infinity;
    let updatedAt = 0;
    let newest: Transaction | null = null;
    for (const t of rows) {
      totalAmount += t.amount;
      totalCost += t.amount * t.purchasePrice;
      if (!earliestDate || t.purchaseDate < earliestDate)
        earliestDate = t.purchaseDate;
      if (t.createdAt < createdAt) createdAt = t.createdAt;
      if (t.updatedAt > updatedAt) updatedAt = t.updatedAt;
      if (!newest || t.createdAt > newest.createdAt) newest = t;
    }
    result.push({
      id: hashString(coinId),
      coinId,
      coinName: newest?.coinName ?? "",
      coinSymbol: newest?.coinSymbol ?? "",
      coinImage: newest?.coinImage,
      amount: totalAmount,
      purchasePrice: totalAmount > 0 ? totalCost / totalAmount : 0,
      purchaseDate: earliestDate,
      transactionCount: rows.length,
      order: metaMap.get(coinId)?.order,
      createdAt,
      updatedAt,
    });
  }
  return result;
}

/** Stable numeric hash of a string, used as a React key for the derived holding. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
