import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { smoothPath, type PathPoint } from '../../lib/svgPath';
import type { ArenaDistribution } from '../../hooks/useStatsArena';

interface GroupDistributionChartProps {
  distribution: ArenaDistribution;
}

// This is an "emphasis" chart, not a generic distribution plot: one muted
// gray curve is context (the group, modeled — the RPC deliberately only
// exposes the group's mean/stddev, never individual members' stakes, so this
// draws a normal-distribution curve from those two numbers rather than a
// true empirical density), and the user's own position is the one accent
// marker breaking through it. Context stays recessive; the point stays loud.

const VW = 200;
const VH = 64;
const PAD_Y = 8;
const SAMPLES = 41;
const Z_RANGE = 3; // std-devs shown on each side

function normalPdf(z: number): number {
  return Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
}

function zToX(z: number): number {
  return ((z + Z_RANGE) / (Z_RANGE * 2)) * VW;
}

function pdfToY(pdf: number, maxPdf: number): number {
  return PAD_Y + (1 - pdf / maxPdf) * (VH - PAD_Y * 2);
}

export function GroupDistributionChart({ distribution }: GroupDistributionChartProps) {
  const { t } = useLangStore();
  const reduce = useReducedMotion();
  const gradientId = useId();

  const { avg_stake, group_avg_stake, group_stddev_stake, risk_score } = distribution;

  if (avg_stake === 0 && group_avg_stake === 0) {
    return <p className="font-mono text-sm text-text-muted">{t('arenaDistributionEmpty')}</p>;
  }

  const z =
    group_stddev_stake > 0
      ? Math.max(-Z_RANGE, Math.min(Z_RANGE, (avg_stake - group_avg_stake) / group_stddev_stake))
      : 0;

  const maxPdf = normalPdf(0);
  const pts: PathPoint[] = Array.from({ length: SAMPLES }, (_, i) => {
    const zi = -Z_RANGE + (i / (SAMPLES - 1)) * Z_RANGE * 2;
    return { x: zToX(zi), y: pdfToY(normalPdf(zi), maxPdf) };
  });
  const linePath = smoothPath(pts);
  const areaPath = `${linePath} L ${VW} ${VH} L 0 ${VH} Z`;

  const markerX = zToX(z);
  const markerY = pdfToY(normalPdf(z), maxPdf);

  const ariaLabel = t('arenaDistributionAvgStakeAria')
    .replace('{0}', String(avg_stake))
    .replace('{1}', String(group_avg_stake));

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-text-muted)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-text-muted)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Group average baseline */}
        <line
          x1={zToX(0)}
          y1={PAD_Y}
          x2={zToX(0)}
          y2={VH}
          stroke="var(--color-border-subtle)"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Context curve — the group, muted */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' as const }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' as const }}
        />

        {/* The point — user's own position, glowing accent marker */}
        <motion.circle
          cx={markerX}
          cy={markerY}
          r={7}
          fill="var(--arena-glow)"
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 100, damping: 15, delay: 0.3 }}
          style={{ transformOrigin: `${markerX}px ${markerY}px` }}
        />
        <motion.circle
          cx={markerX}
          cy={markerY}
          r={3}
          fill="var(--color-accent-green)"
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 100, damping: 15, delay: 0.35 }}
          style={{ transformOrigin: `${markerX}px ${markerY}px` }}
        />
      </svg>

      <div className="mt-2 flex items-baseline justify-between font-mono text-xs">
        <span className="text-accent-green font-semibold">
          {t('you')}: {avg_stake}
        </span>
        <span className="text-text-muted">
          {t('arenaRiskTile')}: {risk_score}
        </span>
      </div>
    </div>
  );
}
