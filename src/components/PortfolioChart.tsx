import { useMemo, useState } from "react";
import type { PortfolioPoint } from "@/hooks/usePortfolioHistory";
import { formatCurrency } from "@/lib/calculations";

interface PortfolioChartProps {
  data: PortfolioPoint[];
  loading?: boolean;
  costBasis?: number;
}

const WIDTH = 900;
const HEIGHT = 300;
const PAD_X = 8;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;

export function PortfolioChart({ data, loading, costBasis }: PortfolioChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => buildGeometry(data, costBasis), [data, costBasis]);

  if (loading && data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-border bg-surface-3">
        <p className="text-sm text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-border bg-surface-3">
        <p className="text-sm text-muted-foreground">
          History unavailable. Add a holding to see your portfolio trajectory.
        </p>
      </div>
    );
  }

  const active = hover !== null ? data[hover] : data[data.length - 1];
  const activeX = hover !== null ? geometry.xs[hover] : geometry.xs[geometry.xs.length - 1];
  const activeY = hover !== null ? geometry.ys[hover] : geometry.ys[geometry.ys.length - 1];

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const nearest = nearestIndex(geometry.xs, relX);
    setHover(nearest);
  }

  return (
    <div className="relative rounded-2xl border border-border bg-surface-3 px-5 pt-6 pb-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-[300px] w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="portfolio-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {geometry.gridY.map((y, i) => (
          <line
            key={i}
            x1={PAD_X}
            y1={y}
            x2={WIDTH - PAD_X}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="3 6"
          />
        ))}

        {/* cost basis line */}
        {geometry.costY !== null && (
          <line
            x1={PAD_X}
            y1={geometry.costY}
            x2={WIDTH - PAD_X}
            y2={geometry.costY}
            stroke="var(--muted-foreground)"
            strokeDasharray="6 5"
            strokeWidth={1.25}
            opacity={0.6}
          />
        )}

        <path d={geometry.areaPath} fill="url(#portfolio-fill)" />
        <path
          d={geometry.linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* crosshair */}
        <line
          x1={activeX}
          y1={PAD_TOP - 6}
          x2={activeX}
          y2={HEIGHT - PAD_BOTTOM + 4}
          stroke="var(--muted-foreground)"
          strokeDasharray="3 4"
          strokeWidth={1}
          opacity={0.55}
        />
        <circle cx={activeX} cy={activeY} r={14} fill="var(--primary)" opacity={0.18} />
        <circle
          cx={activeX}
          cy={activeY}
          r={6.5}
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth={2.25}
        />

        {/* x labels */}
        <g fontFamily="var(--font-mono)" fontSize={10} fill="var(--muted-foreground)">
          {geometry.xLabels.map((label, i) => (
            <text key={i} x={label.x} y={HEIGHT - 8}>
              {label.text}
            </text>
          ))}
        </g>
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute rounded-xl bg-foreground px-3.5 py-2.5 text-background shadow-lg"
          style={{
            top: 24,
            left: `min(${(activeX / WIDTH) * 100}%, calc(100% - 200px))`,
            transform: activeX / WIDTH > 0.85 ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="text-[0.68rem] font-medium opacity-60">
            {formatDate(active.t)}
          </p>
          <p className="font-mono tabular text-base font-bold">
            {formatCurrency(active.v)}
          </p>
          {costBasis !== undefined && (
            <p
              className="font-mono tabular text-[0.7rem] font-semibold"
              style={{ color: active.v >= costBasis ? "var(--gain)" : "var(--loss)" }}
            >
              {active.v >= costBasis ? "▲" : "▼"}{" "}
              {formatCurrency(active.v - costBasis)} ·{" "}
              {(((active.v - costBasis) / costBasis) * 100).toFixed(2)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface Geometry {
  xs: number[];
  ys: number[];
  linePath: string;
  areaPath: string;
  gridY: number[];
  costY: number | null;
  xLabels: { x: number; text: string }[];
}

function buildGeometry(data: PortfolioPoint[], costBasis?: number): Geometry {
  if (data.length === 0) {
    return { xs: [], ys: [], linePath: "", areaPath: "", gridY: [], costY: null, xLabels: [] };
  }

  const values = data.map((d) => d.v);
  const times = data.map((d) => d.t);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (costBasis !== undefined) {
    min = Math.min(min, costBasis);
    max = Math.max(max, costBasis);
  }
  if (min === max) {
    min = min * 0.98;
    max = max * 1.02;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const tMin = times[0];
  const tMax = times[times.length - 1];
  const usableWidth = WIDTH - PAD_X * 2;
  const usableHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xs = times.map((t) => PAD_X + ((t - tMin) / Math.max(1, tMax - tMin)) * usableWidth);
  const ys = values.map(
    (v) => PAD_TOP + (1 - (v - min) / (max - min)) * usableHeight
  );

  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(" ");
  const areaPath =
    linePath +
    ` L ${xs[xs.length - 1].toFixed(2)} ${(HEIGHT - PAD_BOTTOM).toFixed(2)}` +
    ` L ${xs[0].toFixed(2)} ${(HEIGHT - PAD_BOTTOM).toFixed(2)} Z`;

  const gridY = [0.2, 0.4, 0.6, 0.8].map((p) => PAD_TOP + p * usableHeight);
  const costY =
    costBasis !== undefined
      ? PAD_TOP + (1 - (costBasis - min) / (max - min)) * usableHeight
      : null;

  const xLabels = pickLabels(times, xs, 6);

  return { xs, ys, linePath, areaPath, gridY, costY, xLabels };
}

function pickLabels(times: number[], xs: number[], count: number) {
  const step = Math.max(1, Math.floor(times.length / (count - 1)));
  const labels: { x: number; text: string }[] = [];
  for (let i = 0; i < times.length; i += step) {
    labels.push({ x: xs[i], text: formatDate(times[i]) });
    if (labels.length >= count - 1) break;
  }
  labels.push({ x: xs[xs.length - 1], text: formatDate(times[times.length - 1]) });
  return labels;
}

function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1] - x) < Math.abs(xs[lo] - x)) return lo - 1;
  return lo;
}

function formatDate(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
