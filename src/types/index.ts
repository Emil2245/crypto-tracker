export interface Holding {
  id?: number;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  coinImage?: string;
  amount: number;
  purchasePrice: number;
  purchaseDate: string; // ISO date YYYY-MM-DD
  /** Custom-order rank in the sidebar list; lower = earlier. */
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  large?: string;
}
