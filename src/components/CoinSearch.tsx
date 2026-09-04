import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { searchCoins } from "@/lib/coingecko";
import { cn } from "@/lib/utils";
import type { CoinSearchResult } from "@/types";

interface CoinSearchProps {
  onSelect: (coin: CoinSearchResult) => void;
  value?: string;
  placeholder?: string;
}

export function CoinSearch({ onSelect, value, placeholder }: CoinSearchProps) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    const coins = await searchCoins(q);
    setResults(coins);
    setLoading(false);
    setIsOpen(coins.length > 0);
    setSelectedIdx(-1);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(coin: CoinSearchResult) {
    setQuery(`${coin.name} (${coin.symbol.toUpperCase()})`);
    setIsOpen(false);
    onSelect(coin);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIdx]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search cryptocurrency…"}
          className="h-11 rounded-xl pl-10 pr-10 font-mono text-sm"
          id="coin-search-input"
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          className="absolute z-[60] mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in-0 slide-in-from-top-2 duration-200"
          style={{
            background: "var(--popover)",
            boxShadow:
              "0 20px 40px rgba(23, 20, 32, 0.16), 0 4px 12px rgba(23, 20, 32, 0.08)",
          }}
        >
          <ScrollArea className="max-h-[280px]">
            <ul className="flex flex-col gap-0.5 p-1.5">
              {results.map((coin, idx) => (
                <li key={coin.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      idx === selectedIdx
                        ? "bg-accent-soft"
                        : "hover:bg-secondary"
                    )}
                    onClick={() => handleSelect(coin)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    id={`coin-option-${coin.id}`}
                  >
                    <img
                      src={coin.thumb}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full ring-1 ring-border"
                      loading="lazy"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold tracking-tight">
                        {coin.name}
                      </span>
                      <span className="mt-0.5 font-mono text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                        {coin.symbol}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
