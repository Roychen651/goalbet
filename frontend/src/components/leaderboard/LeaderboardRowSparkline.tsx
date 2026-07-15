import { smoothPath } from '../../lib/svgPath';

// Sprint 21 — a compact per-row trend line, next to each player's name.
// Reuses smoothPath() (extracted in Sprint 15 specifically so every
// hand-built SVG chart in this codebase shares one spline implementation)
// rather than hand-rolling new curve math. Deliberately plain/static (no
// Framer Motion draw-on) — a leaderboard can render many of these
// simultaneously, one per row, unlike Sparkline.tsx's single big instance
// on the Profile page which can afford the animated entrance.

const VW = 56;
const VH = 18;
const PAD = 2;

interface LeaderboardRowSparklineProps {
  /** Points earned on the last N resolved predictions, oldest -> newest. */
  points: number[];
  className?: string;
}

export function LeaderboardRowSparkline({ points, className }: LeaderboardRowSparklineProps) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const pts = points.map((v, i) => ({
    x: (i / (points.length - 1)) * VW,
    y: max === min ? VH / 2 : PAD + (1 - (v - min) / span) * (VH - PAD * 2),
  }));

  // Slope-driven color: same CVD-safe ice-blue/red-pink brand pair used
  // everywhere else in this codebase for a positive/negative signal.
  const slope = points[points.length - 1] - points[0];
  const color = slope >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-orange)';

  return (
    <svg
      width={VW}
      height={VH}
      viewBox={`0 0 ${VW} ${VH}`}
      className={className}
      style={{ direction: 'ltr' }}
      aria-hidden
    >
      <path
        d={smoothPath(pts)}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
