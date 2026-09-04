import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CoinSearch } from "@/components/CoinSearch";
import * as coingecko from "@/lib/coingecko";
import type { CoinSearchResult } from "@/types";

vi.mock("@/lib/coingecko");

test("shows results after search resolves", async () => {
  const mockSearch = vi.spyOn(coingecko, "searchCoins");
  mockSearch.mockResolvedValueOnce([
    { id: "bitcoin", name: "Bitcoin", symbol: "btc", thumb: "" },
  ]);

  const onSelect = vi.fn();
  render(<CoinSearch onSelect={onSelect} />);

  const input = screen.getByRole("textbox");
  await userEvent.type(input, "bit");

  await waitFor(() => {
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  });

  mockSearch.mockRestore();
});

test("discards stale results when a newer search is in flight", async () => {
  const mockSearch = vi.spyOn(coingecko, "searchCoins");

  // First call (slow) — resolves after the second
  let resolveFirst!: (value: CoinSearchResult[]) => void;
  mockSearch.mockImplementationOnce(
    () => new Promise((r) => (resolveFirst = r))
  );
  // Second call (fast) — resolves first
  mockSearch.mockResolvedValueOnce([
    { id: "ethereum", name: "Ethereum", symbol: "eth", thumb: "" },
  ]);

  const onSelect = vi.fn();
  render(<CoinSearch onSelect={onSelect} />);

  const input = screen.getByRole("textbox");

  // Type "bi" → fires first search
  await userEvent.type(input, "bi", { delay: 10 });
  // Wait for the 350ms debounce to fire the first search
  await new Promise((r) => setTimeout(r, 400));
  // Type "eth" → fires second search (debounce restarts)
  await userEvent.type(input, "eth", { delay: 10 });

  // Let the debounce fire and the fast response resolve
  await waitFor(() => {
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
  });

  // Now resolve the slow "bi" search — should NOT overwrite
  resolveFirst([
    { id: "bitcoin", name: "Bitcoin", symbol: "btc", thumb: "" },
  ]);

  // Wait a tick for the stale resolve to be processed
  await new Promise((r) => setTimeout(r, 50));

  // Results should still be Ethereum, not Bitcoin
  expect(screen.getByText("Ethereum")).toBeInTheDocument();
  expect(screen.queryByText("Bitcoin")).not.toBeInTheDocument();

  mockSearch.mockRestore();
});
