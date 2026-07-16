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
  value: number; // 0-100
  label: string;
  sampleSize: number;
  color?: string;
}

export function OracleDial({ value, label, sampleSize, color }: OracleDialProps) {
  const uid = useId();
  const gradId = `od-grad-${uid}`;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const resolvedColor = color ?? `url(#${gradId})`;

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${clamped}%`}>
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
        {/* value arc */}
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
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="font-mono font-bold tabular-nums"
          style={{ fontSize: 18, fill: 'var(--color-text-primary)' }}
        >
          {clamped}%
        </text>
      </svg>
      <span className="text-[9px] uppercase tracking-wider text-white/40 -mt-0.5">{label}</span>
      <span className="text-[8px] text-white/25">
        {sampleSize < 10 ? `n=${sampleSize}` : ''}
      </span>
    </div>
  );
}
