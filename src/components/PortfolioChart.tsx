import { useMemo, useRef, useState, useEffect } from "react";
import type { PortfolioPoint } from "@/hooks/usePortfolioHistory";
import { formatCurrency } from "@/lib/calculations";

interface PortfolioChartProps {
  data: PortfolioPoint[];
  loading?: boolean;
  costBasis?: number;
}

const HEIGHT = 300;
const PAD_X = 8;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;

export function PortfolioChart({ data, loading, costBasis }: PortfolioChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track real rendered width so label count and tooltip clamp correctly on
  // any screen size — including mobile where the chart might be 320 px wide.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // How many x-axis labels fit without overlapping (each label ~ 52 px wide).
  const maxLabels = Math.max(2, Math.floor(containerWidth / 60));

  const geometry = useMemo(
    () => buildGeometry(data, costBasis, containerWidth, maxLabels),
    [data, costBasis, containerWidth, maxLabels]
  );

  if (loading && data.length === 0) {
    return (
      <div ref={containerRef} className="flex h-[240px] items-center justify-center rounded-2xl border border-border bg-surface-3 sm:h-[300px]">
        <p className="text-sm text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div ref={containerRef} className="flex h-[240px] items-center justify-center rounded-2xl border border-border bg-surface-3 sm:h-[300px]">
        <p className="text-sm text-muted-foreground text-center px-4">
          History unavailable. Add a holding to see your portfolio trajectory.
        </p>
      </div>
    );
  }

  const activeIdx = hover !== null ? hover : data.length - 1;
  const active = data[activeIdx];
  const activeX = geometry.xs[activeIdx] ?? 0;
  const activeY = geometry.ys[activeIdx] ?? 0;

  // Tooltip width changes with screen size; clamp its left edge so it never
  // bleeds off either side of the container.
  const TOOLTIP_W = containerWidth < 480 ? 150 : 200;
  const tooltipLeftPct = (activeX / containerWidth) * 100;
  const flipThreshold = 1 - TOOLTIP_W / containerWidth;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * containerWidth;
    setHover(nearestIndex(geometry.xs, relX));
  }

  function handleTouch(e: React.TouchEvent<SVGSVGElement>) {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((touch.clientX - rect.left) / rect.width) * containerWidth;
    setHover(nearestIndex(geometry.xs, relX));
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-border bg-surface-3 px-3 pt-5 pb-3 sm:px-5 sm:pt-6 sm:pb-4"
    >
      <svg
        viewBox={`0 0 ${containerWidth} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-[240px] w-full sm:h-[300px]"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHover(null)}
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
            x2={containerWidth - PAD_X}
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
            x2={containerWidth - PAD_X}
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

        {/* x-axis labels — font size scales with container */}
        <g
          fontFamily="var(--font-mono)"
          fontSize={containerWidth < 480 ? 9 : 10}
          fill="var(--muted-foreground)"
        >
          {geometry.xLabels.map((label, i) => (
            <text key={i} x={label.x} y={HEIGHT - 8} textAnchor="middle">
              {label.text}
            </text>
          ))}
        </g>
      </svg>

      {/* Tooltip — absolutely positioned relative to container */}
      {active && (
        <div
          className="pointer-events-none absolute rounded-xl bg-foreground px-3 py-2 text-background shadow-lg"
          style={{
            top: 20,
            width: TOOLTIP_W,
            left: tooltipLeftPct > flipThreshold * 100
              ? `calc(${tooltipLeftPct}% - ${TOOLTIP_W}px)`
              : `${tooltipLeftPct}%`,
          }}
        >
          <p className="text-[0.65rem] font-medium opacity-60">{formatDate(active.t)}</p>
          <p className="font-mono tabular text-sm font-bold sm:text-base">
            {formatCurrency(active.v)}
          </p>
          {costBasis !== undefined && (
            <p
              className="font-mono tabular text-[0.65rem] font-semibold"
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

function buildGeometry(
  data: PortfolioPoint[],
  costBasis: number | undefined,
  width: number,
  maxLabels: number
): Geometry {
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
  const usableWidth = width - PAD_X * 2;
  const usableHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xs = times.map((t) => PAD_X + ((t - tMin) / Math.max(1, tMax - tMin)) * usableWidth);
  const ys = values.map((v) => PAD_TOP + (1 - (v - min) / (max - min)) * usableHeight);

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

  const xLabels = pickLabels(times, xs, maxLabels);

  return { xs, ys, linePath, areaPath, gridY, costY, xLabels };
}

function pickLabels(times: number[], xs: number[], count: number) {
  if (times.length === 0) return [];
  const step = Math.max(1, Math.floor((times.length - 1) / (count - 1)));
  const labels: { x: number; text: string }[] = [];
  for (let i = 0; i < times.length - 1; i += step) {
    labels.push({ x: xs[i]!, text: formatDate(times[i]!) });
    if (labels.length >= count - 1) break;
  }
  labels.push({ x: xs[xs.length - 1]!, text: formatDate(times[times.length - 1]!) });
  return labels;
}

function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1]! - x) < Math.abs(xs[lo]! - x)) return lo - 1;
  return lo;
}

function formatDate(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
