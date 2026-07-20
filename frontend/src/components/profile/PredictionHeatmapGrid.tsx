import { useId, useMemo, useState } from 'react';
import { useLangStore } from '../../stores/langStore';
import { interpolateDiverging } from '../../lib/oklch';
import { COIN_COSTS } from '../../lib/constants';

export interface DayActivity {
  date: string; // 'YYYY-MM-DD'
  predictions_made: number;
  points_earned: number;
}

interface PredictionHeatmapGridProps {
  days: DayActivity[];
  windowDays?: number;
}

const CELL = 11;
const GAP = 2.5;
const ROWS = 7;

/**
 * V6 Sprint 45 — a GitHub-contribution-style grid, deliberately scoped to
 * the last ~12 weeks (matching migration 062's own p_days default), never a
 * full 365-day year — see that migration's own comment for why a dense
 * annual grid would misrepresent this app's real per-user prediction
 * volume. Reuses PredictionHeatmap.tsx's established techniques verbatim:
 * interpolateDiverging() for cell color, useId() to avoid <pattern> id
 * collisions across simultaneous instances, direction:'ltr' pinned on the
 * SVG root (the x-axis encodes elapsed-time/week data, a coordinate fact,
 * not a reading-direction one — the same reasoning §21/§47 already
 * established for every other hand-built time-series SVG in this app).
 *
 * Per-day ratio is a stated approximation, not a real "hit rate": the RPC
 * returns points_earned/predictions_made, not a correct/incorrect count,
 * so the color is avg-points-per-prediction normalized against
 * MAX_PER_MATCH (a single match's own points ceiling — the same
 * denominator-sizing discipline as every other ratio visual in this
 * codebase, §34) — 0 avg points is the worst end, a perfect-average day is
 * the best end, never claiming more precision than the data has.
 */
export function PredictionHeatmapGrid({ days, windowDays = 84 }: PredictionHeatmapGridProps) {
  const { t, lang } = useLangStore();
  const patternId = useId();
  const [active, setActive] = useState<DayActivity | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, DayActivity>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  // Build a dense grid of the last `windowDays`, oldest first, so the visual
  // reads left-to-right chronologically regardless of page language.
  const cellDates = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [windowDays]);

  const cols = Math.ceil(cellDates.length / ROWS);
  const gridW = cols * (CELL + GAP);
  const gridH = ROWS * (CELL + GAP);

  if (days.length === 0) {
    return <p className="font-mono text-sm text-text-muted">{t('heatmapGridEmpty')}</p>;
  }

  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${gridW} ${gridH}`}
        role="img"
        aria-label={t('heatmapGridTitle')}
        style={{ direction: 'ltr' }}
      >
        <defs>
          <pattern id={`${patternId}-empty`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-text-muted)" strokeWidth="1" opacity="0.25" />
          </pattern>
        </defs>
        {cellDates.map((date, i) => {
          const col = Math.floor(i / ROWS);
          const row = i % ROWS;
          const x = col * (CELL + GAP);
          const y = row * (CELL + GAP);
          const activity = byDate.get(date);

          if (!activity || activity.predictions_made === 0) {
            return (
              <rect
                key={date}
                x={x} y={y} width={CELL} height={CELL} rx={2.5}
                fill={`url(#${patternId}-empty)`}
                className="cursor-pointer"
                onMouseEnter={() => setActive(null)}
                onClick={() => setActive(null)}
              >
                <title>{date}</title>
              </rect>
            );
          }

          // 0 avg points -> ratio 0 (worst); MAX_PER_MATCH avg points (a
          // perfect day) -> ratio 1 (best); a coin-flip-ish day lands near
          // the 0.5 midpoint interpolateDiverging already treats as neutral.
          const avgPts = activity.points_earned / activity.predictions_made;
          const ratio = Math.max(0, Math.min(1, avgPts / COIN_COSTS.MAX_PER_MATCH));
          const { color } = interpolateDiverging(ratio);

          return (
            <rect
              key={date}
              x={x} y={y} width={CELL} height={CELL} rx={2.5}
              fill={color}
              className="cursor-pointer"
              onMouseEnter={() => setActive(activity)}
              onFocus={() => setActive(activity)}
              onClick={() => setActive(activity)}
              tabIndex={0}
              role="button"
            >
              <title>{`${date}: ${activity.predictions_made} · ${activity.points_earned}pts`}</title>
            </rect>
          );
        })}
      </svg>

      {/* Direct-labeled detail line — color is never the only signal
          (dataviz skill's non-negotiable), matching PredictionHeatmap's own
          hover/focus detail line pattern. Fixed height (min-h) so tapping a
          cell never shifts surrounding layout. */}
      <div className="min-h-[18px] mt-1.5 text-xs font-mono tabular-nums text-text-muted">
        {active
          ? `${new Date(active.date).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')} — ${active.predictions_made} ${t('heatmapGridPredictionsLabel')}, ${active.points_earned} ${t('pts')}`
          : t('heatmapGridHint')}
      </div>
    </div>
  );
}
