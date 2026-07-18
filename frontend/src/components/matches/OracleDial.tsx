import { useId } from 'react';
import { motion } from 'framer-motion';

// V5 Sprint 33 — "The Analytics Oracle". A single-percentage semi-circle
// gauge, reserved for genuinely single-value stats (Over 2.5%, BTTS%) —
// NOT used for the 3-way W/D/L split, which reuses StandingsTable.tsx's
// existing chip pattern instead (a categorical split doesn't fit a single
// 0-100 radial gauge honestly). See OracleStatsPanel.tsx.
//
// Math: a semicircle's arc length is half a full circle's circumference
// (C = pi * r, not 2*pi*r). stroke-dashoffset = C * (1 - pct/100) is the
// standard circular-progress-ring formula, applied to a half-circle path
// instead of a full one.

const SIZE = 100;
const R = 38;
const CX = 50;
const CY = 50;
const STROKE = 9;
const CIRCUMFERENCE = Math.PI * R;

interface OracleDialProps {
  value: number | null; // 0-100, or null when sample_size is 0 (migration 059 — never a fabricated 0%)
  label: string;
  sampleSize: number;
  color?: string;
  noDataLabel: string;
}

export function OracleDial({ value, label, sampleSize, color, noDataLabel }: OracleDialProps) {
  const uid = useId();
  const gradId = `od-grad-${uid}`;
  const hasData = value !== null && Number.isFinite(value);
  const clamped = hasData ? Math.max(0, Math.min(100, value)) : 0;
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const resolvedColor = color ?? `url(#${gradId})`;

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={hasData ? `${label}: ${clamped}%` : `${label}: ${noDataLabel}`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE / 2 + 6}`} className="w-full max-w-[92px]" style={{ direction: 'ltr' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--oracle-low)" />
            <stop offset="100%" stopColor="var(--oracle-high)" />
          </linearGradient>
        </defs>
        {/* track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* value arc — omitted entirely when there's no real reading, so a
            "no data" dial never draws even a hairline colored stroke that
            could read as "0 of many, checked" */}
        {hasData && (
          <motion.path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            stroke={resolvedColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: 'easeOut' as const }}
          />
        )}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="font-mono font-bold tabular-nums"
          style={{ fontSize: hasData ? 18 : 14, fill: hasData ? 'var(--color-text-primary)' : 'rgba(255,255,255,0.35)' }}
        >
          {hasData ? `${clamped}%` : '—'}
        </text>
      </svg>
      <span className="text-[9px] uppercase tracking-wider text-white/40 -mt-0.5">{label}</span>
      <span className="text-[8px] text-white/25">
        {!hasData ? noDataLabel : sampleSize < 10 ? `n=${sampleSize}` : ''}
      </span>
    </div>
  );
}
