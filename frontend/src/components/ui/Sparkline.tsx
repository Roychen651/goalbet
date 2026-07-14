import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Sparkline — a pure-SVG, theme-fluid area + line micro-chart.
 *
 * Zero chart-library dependency: the curve is a hand-built path, animated with
 * Framer Motion (already the vendor-framer chunk, so ~0 KB added). All colour
 * comes from CSS variables, so it flips between "Cold Sea Navy" and "Frost"
 * with no JS theme branching. Stroke uses vector-effect so it stays crisp
 * regardless of the non-uniform stretch that fills the container width.
 */

export type SparkTone = 'accent' | 'muted';

interface SparklineProps {
  data: number[];
  /** Reserved pixel height — keeps the box CLS-stable while data loads. */
  height?: number;
  tone?: SparkTone;
  className?: string;
}

// Internal SVG coordinate space. preserveAspectRatio="none" stretches X to the
// container; non-scaling-stroke keeps the line width visually constant.
const VW = 100;
const VH = 36;
const PAD = 3; // vertical breathing room so peaks/troughs aren't clipped

const TONE_VAR: Record<SparkTone, string> = {
  accent: 'var(--color-accent-green)',
  muted: 'var(--color-text-muted)',
};

/** Catmull-Rom → cubic Bézier: a smooth, premium curve through every point. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function Sparkline({ data, height = 32, tone = 'accent', className }: SparklineProps) {
  const gradientId = useId();
  const reduce = useReducedMotion();
  const color = TONE_VAR[tone];

  // Empty / single-point → flat dashed baseline (never collapse the box).
  const insufficient = !data || data.length < 2;

  const min = insufficient ? 0 : Math.min(...data);
  const max = insufficient ? 0 : Math.max(...data);
  const span = max - min || 1; // guard flat series (all equal → mid-line)

  const pts = insufficient
    ? []
    : data.map((v, i) => ({
        x: (i / (data.length - 1)) * VW,
        // Flat series renders as a centred line rather than pinned to an edge.
        y: max === min ? VH / 2 : PAD + (1 - (v - min) / span) * (VH - PAD * 2),
      }));

  const linePath = smoothPath(pts);
  const areaPath = linePath ? `${linePath} L ${VW} ${VH} L 0 ${VH} Z` : '';

  return (
    <div
      className={cn('w-full overflow-hidden', className)}
      style={{ height }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {insufficient ? (
          // Baseline placeholder — same footprint, no layout shift.
          <line
            x1="0"
            y1={VH / 2}
            x2={VW}
            y2={VH / 2}
            stroke="var(--color-border-subtle)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <>
            {/* Area fill (fades in) */}
            <motion.path
              d={areaPath}
              fill={`url(#${gradientId})`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.15 }}
            />
            {/* Line stroke (draws on) */}
            <motion.path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: 'easeOut' as const }}
            />
          </>
        )}
      </svg>
    </div>
  );
}
