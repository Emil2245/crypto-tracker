/**
 * A single purchase of a crypto. The ledger stores transactions and derives a
 * per-coin `Holding` (aggregated across all transactions) on the fly.
 */
export interface Transaction {
  id?: number;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage?: string;
  amount: number;
  purchasePrice: number;
  purchaseDate: string; // ISO date YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

/** The shape a form submits before id/timestamps are stamped on by Dexie. */
export type TransactionInput = Omit<
  Transaction,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * A derived, read-only view of one coin — the amount, weighted-average cost
 * basis and oldest purchase date aggregated across every transaction of that
 * coin. Never persisted; computed from `Transaction[]` (+ sidebar order).
 */
export interface Holding {
  /** Coins are keyed by coinId; this is a stable numeric hash used for React keys. */
  id?: number;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage?: string;
  amount: number;
  purchasePrice: number; // weighted average across transactions
  purchaseDate: string; // earliest transaction date
  /** Number of transactions backing this holding. */
  transactionCount: number;
  /** Custom-order rank in the sidebar list; lower = earlier. */
  order?: number;
  createdAt: number; // earliest transaction createdAt
  updatedAt: number; // latest transaction updatedAt
}

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  large?: string;
}
