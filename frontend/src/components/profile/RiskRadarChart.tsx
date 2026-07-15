import { useId, useState } from 'react';
import { useLangStore } from '../../stores/langStore';
import { interpolateDiverging } from '../../lib/oklch';
import { cn } from '../../lib/utils';

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

// SIZE is deliberately larger than 2*MAX_RADIUS — the extra margin exists
// solely so axis labels ("Live Activity" / "פעילות חיה", the longest of
// the 5) have room to render without clipping against the viewBox edge.
// Labels render via <foreignObject> + a real truncating <div> (CSS
// text-overflow), not raw SVG <text> — a fixed, known label set could
// probably be hand-tuned to just barely fit as plain <text>, but that's
// exactly the kind of pixel-guess that already broke once in this
// codebase (PredictionHeatmap, Sprint 15). A real DOM box with `truncate`
// is a robust guarantee instead of an untested guess, in both languages.
// These five constants were solved together, not picked independently —
// verified numerically (every label box's [x, x+W] and [y, y+H] stays
// inside [0, SIZE] for all 5 axis angles, worst case cos(theta)=~0.951)
// rather than eyeballed. Changing any one requires re-checking the other
// four against the same worst-case angle.
const SIZE = 300;
const CENTER = SIZE / 2;
const MAX_RADIUS = 64;
const LABEL_RADIUS_RATIO = 1.15;
const LABEL_BOX_W = 68;
const LABEL_BOX_H = 18;
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
      {/* An <svg> with only `width="100%"` and no explicit `height` relies on
          the browser deriving intrinsic aspect ratio purely from viewBox —
          support for that derivation is inconsistent enough in practice that
          it shipped as a real bug here (the chart rendered correctly but sat
          inside a container many times taller than the drawn content, a huge
          blank gap before the text below it). An explicit `aspect-square`
          wrapper (fixed 1:1 ratio, the same CLS-safe-box technique already
          used by Sparkline.tsx) plus width=100% height=100% on the svg
          itself is the robust fix — no dependence on viewBox-to-box
          derivation at all. */}
      <div className="max-w-[280px] aspect-square mx-auto">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          height="100%"
          className="block"
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
          const labelPt = vertex(i, axes.length, LABEL_RADIUS_RATIO);
          // anchor here means "which edge of the label box sits at labelPt"
          // — purely a function of cos(theta)'s sign (physical geometry),
          // never an isRTL branch. The SVG root is pinned direction:'ltr',
          // so physical left/right below always matches this anchor.
          const anchor = textAnchorFor(labelPt.theta);
          const isActive = selected === i;
          const boxX = anchor === 'start' ? labelPt.x
            : anchor === 'end' ? labelPt.x - LABEL_BOX_W
            : labelPt.x - LABEL_BOX_W / 2;
          return (
            <g key={a.key}>
              <foreignObject x={boxX} y={labelPt.y - LABEL_BOX_H / 2} width={LABEL_BOX_W} height={LABEL_BOX_H}>
                <div
                  className={cn(
                    'font-barlow uppercase select-none truncate leading-none',
                    'flex items-center h-full',
                  )}
                  style={{
                    fontSize: 8.5,
                    letterSpacing: '0.02em',
                    color: isActive ? accent : 'var(--color-text-muted)',
                    textAlign: anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center',
                    justifyContent: anchor === 'start' ? 'flex-start' : anchor === 'end' ? 'flex-end' : 'center',
                  }}
                >
                  {a.label}
                </div>
              </foreignObject>
              {/* The visible dot (r=3.5-5) is nowhere near a real touch
                  target — reported live, on a real phone/thumb. A separate,
                  invisible r=24 circle (~45px at this chart's max render
                  width, clearing Apple HIG's 44pt minimum) carries all the
                  actual interaction; the small dot is purely decorative and
                  pointer-events-none so it never competes with its own hit
                  area. */}
              <circle
                cx={dataPt.x}
                cy={dataPt.y}
                r={24}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${a.label}: ${a.raw}`}
                className="cursor-pointer outline-none"
                onClick={() => setSelected(prev => prev === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(prev => prev === i ? null : i);
                  }
                }}
              />
              <circle
                cx={dataPt.x}
                cy={dataPt.y}
                r={isActive ? 6 : 4.5}
                fill={isActive ? accent : 'var(--color-bg-card)'}
                stroke={accent}
                strokeWidth={1.5}
                pointerEvents="none"
                className="transition-[r] duration-150"
              />
            </g>
          );
        })}
        </svg>
      </div>

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
