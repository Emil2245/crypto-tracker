interface CoinMarkProps {
  symbol: string;
  image?: string;
  size?: number;
}

/**
 * Circular coin badge — uses the CoinGecko thumb when available,
 * otherwise renders a stable letter/gradient placeholder.
 */
export function CoinMark({ symbol, image, size = 40 }: CoinMarkProps) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full ring-1 ring-border object-cover"
      />
    );
  }

  const initials = symbol.slice(0, 2).toUpperCase();
  const hue = stableHue(symbol);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, oklch(0.72 0.16 ${hue}), oklch(0.55 0.18 ${hue - 20}))`,
        fontSize: size * 0.36,
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-mono font-bold text-white shadow-sm"
    >
      {initials}
    </div>
  );
}

function stableHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}
