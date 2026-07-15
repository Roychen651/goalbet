import { useId, useState } from 'react';
import { useLangStore } from '../../stores/langStore';
import { interpolateDiverging } from '../../lib/oklch';

// Sprint 22 — pure trigonometric SVG radar/spider chart. No charting
// library (this codebase's standing "Strict Charting Law" — see §25/§30
// of CLAUDE.md — pure hand-built SVG + already-loaded primitives only).
//
// For center (cx, cy), radius r, and a normalized value v in [0, 1] on
// axis i of n total axes:
//   theta_i = -PI/2 + i * (2*PI / n)     // -90deg start so axis 0 points up
//   x_i = cx + r * v * cos(theta_i)
//   y_i = cy + r * v * sin(theta_i)
//
// RTL: this SVG's own coordinate math is the sole source of layout — the
// root pins direction:'ltr' so an RTL page ancestor (Hebrew) can never
// re-flip it a second time. That exact double-flip bug already shipped
// once in this codebase (PredictionHeatmap.tsx, Sprint 15) — see the
// Common Pitfalls entry in CLAUDE.md §21. text-anchor is derived purely
// from cos(theta)'s sign, never from an isRTL branch.

export interface RadarAxisDatum {
  key: string;
  label: string;
  /** Already clamped to [0, 1] by the caller — this component never re-derives meaning from raw stats. */
  value: number;
  /** Human-readable raw value for the tap-to-reveal detail line, e.g. "62%" or "4.2 avg stake". */
  raw: string;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const MAX_RADIUS = 72;
const RING_STEPS = [0.25, 0.5, 0.75, 1];

function vertex(i: number, count: number, magnitude: number) {
  const theta = -Math.PI / 2 + i * ((2 * Math.PI) / count);
  return {
    x: CENTER + MAX_RADIUS * magnitude * Math.cos(theta),
    y: CENTER + MAX_RADIUS * magnitude * Math.sin(theta),
    theta,
  };
}

function textAnchorFor(theta: number): 'start' | 'end' | 'middle' {
  const cos = Math.cos(theta);
  if (cos > 0.1) return 'start';
  if (cos < -0.1) return 'end';
  return 'middle';
}

export function RiskRadarChart({ axes }: { axes: RadarAxisDatum[] }) {
  const { t } = useLangStore();
  const [selected, setSelected] = useState<number | null>(null);
  const gradientId = useId();
  const accent = interpolateDiverging(1).color; // fixed "cold/good" anchor — a themed accent, not a per-axis scale

  const dataPoints = axes.map((a, i) => vertex(i, axes.length, Math.max(0, Math.min(1, a.value))));
  const polygonPoints = dataPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  const activeAxis = selected !== null ? axes[selected] : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        className="max-w-[280px] mx-auto block"
        style={{ direction: 'ltr' }}
        role="img"
        aria-label={t('radarTitle')}
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
          </radialGradient>
        </defs>

        {/* Background grid rings */}
        {RING_STEPS.map(step => {
          const ringPts = axes
            .map((_, i) => vertex(i, axes.length, step))
            .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(' ');
          return (
            <polygon
              key={step}
              points={ringPts}
              fill="none"
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
            />
          );
        })}

        {/* Axis spokes */}
        {axes.map((a, i) => {
          const edge = vertex(i, axes.length, 1);
          return (
            <line
              key={a.key}
              x1={CENTER} y1={CENTER}
              x2={edge.x} y2={edge.y}
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon — glowing OKLCH border + translucent gradient fill */}
        <polygon
          points={polygonPoints}
          fill={`url(#${gradientId})`}
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
        />

        {/* Interactive vertex markers + axis labels */}
        {axes.map((a, i) => {
          const dataPt = dataPoints[i];
          const labelPt = vertex(i, axes.length, 1.24);
          const anchor = textAnchorFor(labelPt.theta);
          const isActive = selected === i;
          return (
            <g key={a.key}>
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor={anchor}
                dominantBaseline="central"
                className="font-barlow uppercase tracking-wide select-none"
                style={{ fontSize: 9, fill: isActive ? accent : 'var(--color-text-muted)' }}
              >
                {a.label}
              </text>
              <circle
                cx={dataPt.x}
                cy={dataPt.y}
                r={isActive ? 5 : 3.5}
                fill={isActive ? accent : 'var(--color-bg-card)'}
                stroke={accent}
                strokeWidth={1.5}
                tabIndex={0}
                role="button"
                aria-label={`${a.label}: ${a.raw}`}
                className="cursor-pointer transition-[r] duration-150 outline-none"
                onClick={() => setSelected(prev => prev === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(prev => prev === i ? null : i);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Fixed-height detail line — CLS-safe whether or not a point is selected */}
      <div className="mt-2 h-5 flex items-center justify-center text-center">
        {activeAxis ? (
          <span className="text-xs font-display">
            <span className="text-text-muted">{activeAxis.label}: </span>
            <span className="font-mono font-bold tabular-nums text-white">{activeAxis.raw}</span>
          </span>
        ) : (
          <span className="text-text-muted text-[10px] opacity-50">{t('radarTapHint')}</span>
        )}
      </div>
    </div>
  );
}
