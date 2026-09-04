/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";
import type { Holding, Transaction, TransactionInput } from "@/types";

export interface PortfolioContextValue {
  holdings: Holding[];
  prices: Record<string, number>;
  loading: boolean;
  lastUpdated: number | null;
  error: string | null;
  refetch: () => void;
  getTransactions: (coinId: string) => Promise<Transaction[]>;
  onAdd: (transaction: TransactionInput) => void;
  onUpdateTransaction: (
    id: number,
    updates: Partial<Omit<Transaction, "id" | "createdAt">>
  ) => void;
  onDelete: (coinId: string) => Promise<void>;
  onReorder: (orderedCoinIds: string[]) => void;
}

export const PortfolioContext = createContext<PortfolioContextValue | null>(
  null
);

export function PortfolioProvider({
  value,
  children,
}: {
  value: PortfolioContextValue;
  children: ReactNode;
}) {
  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within <PortfolioProvider>");
  return ctx;
}