import { useId, useMemo, useState } from 'react';
import { useLangStore } from '../../stores/langStore';
import { interpolateDiverging } from '../../lib/oklch';
import type { ArenaHeatmapCell } from '../../hooks/useStatsArena';

interface PredictionHeatmapProps {
  cells: ArenaHeatmapCell[];
}

const BET_TYPES = ['full_match', 'momentum'] as const;

const VW = 240;
const LABEL_W = 84;
const HEADER_H = 18;
const ROW_H = 30;
const CELL_GAP = 2;
const LEGEND_H = 22;

// Contrast-aware label ink — chosen from the cell's own resolved lightness,
// not the app theme (rule: text wears text tokens, never the series color;
// this is the *neutral ink*, picked for contrast, not identity).
function inkFor(l: number): string {
  return l > 62 ? '#0a1733' : '#ffffff';
}

// League names come straight from ESPN ("English Premier League", "UEFA
// Conference League") and can run long. Plain character-count truncation —
// deterministic, zero browser-support risk, unlike the clip-path this
// replaced (see the direction:ltr note below for why that approach broke).
const MAX_LABEL_CHARS = 16;
function truncateLabel(name: string): string {
  return name.length > MAX_LABEL_CHARS ? `${name.slice(0, MAX_LABEL_CHARS - 1)}…` : name;
}

export function PredictionHeatmap({ cells }: PredictionHeatmapProps) {
  const { t, lang } = useLangStore();
  const isRTL = lang === 'he';
  const patternId = useId();
  const [active, setActive] = useState<ArenaHeatmapCell | null>(null);
  const [showTable, setShowTable] = useState(false);

  const leagues = useMemo(() => {
    const seen = new Map<number, string>();
    for (const c of cells) if (!seen.has(c.league_id)) seen.set(c.league_id, c.league_name);
    return Array.from(seen.entries()).map(([league_id, league_name]) => ({ league_id, league_name }));
  }, [cells]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ArenaHeatmapCell>();
    for (const c of cells) m.set(`${c.league_id}:${c.bet_type}`, c);
    return m;
  }, [cells]);

  if (leagues.length === 0) {
    return <p className="font-mono text-sm text-text-muted">{t('arenaHeatmapEmpty')}</p>;
  }

  const gridW = VW - LABEL_W;
  const colW = gridW / BET_TYPES.length;
  const gridX0 = isRTL ? 0 : LABEL_W;
  const labelX = isRTL ? VW - 4 : 4;
  const labelAnchor: 'start' | 'end' = isRTL ? 'end' : 'start';

  function colX(j: number): number {
    const visualIndex = isRTL ? BET_TYPES.length - 1 - j : j;
    return gridX0 + visualIndex * colW;
  }

  const totalH = HEADER_H + leagues.length * ROW_H + LEGEND_H + 4;

  const betTypeLabel = (bt: (typeof BET_TYPES)[number]) =>
    bt === 'full_match' ? t('arenaBetTypeFullMatch') : t('arenaBetTypeMomentum');

  const legendStops = [0, 0.5, 1].map(r => interpolateDiverging(r).color);

  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${VW} ${totalH}`}
        role="img"
        aria-label={t('arenaHeatmapTitle')}
        // Force physical (non-bidi) text-anchor resolution. BentoArena sets
        // dir="rtl" on an ancestor for Hebrew, and per spec SVG's
        // text-anchor start/end are relative to that inherited direction —
        // combined with the isRTL ? 'end' : 'start' mirroring below (which
        // assumes *physical* start/end), the two flips canceled out wrong,
        // pushing every row label almost entirely off the visible canvas.
        // Pinning direction:ltr here makes this component's own coordinate
        // math the sole source of RTL-awareness, same as intended.
        style={{ display: showTable ? 'none' : 'block', direction: 'ltr' }}
      >
        <defs>
          <pattern id={patternId} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border-subtle)" strokeWidth="2" />
          </pattern>
          <linearGradient id={`${patternId}-legend`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={legendStops[0]} />
            <stop offset="50%" stopColor={legendStops[1]} />
            <stop offset="100%" stopColor={legendStops[2]} />
          </linearGradient>
        </defs>

        {/* Column headers */}
        {BET_TYPES.map((bt, j) => (
          <text
            key={bt}
            x={colX(j) + colW / 2}
            y={HEADER_H - 5}
            textAnchor="middle"
            className="font-barlow"
            fontSize={7.5}
            fill="var(--color-text-muted)"
          >
            {betTypeLabel(bt)}
          </text>
        ))}

        {/* Rows */}
        {leagues.map((lg, i) => {
          const rowY = HEADER_H + i * ROW_H;
          return (
            <g key={lg.league_id}>
              <text
                x={labelX}
                y={rowY + ROW_H / 2}
                textAnchor={labelAnchor}
                dominantBaseline="middle"
                className="font-barlow"
                fontSize={8}
                fill="var(--color-text-primary)"
              >
                <title>{lg.league_name}</title>
                {truncateLabel(lg.league_name)}
              </text>

              {BET_TYPES.map((bt, j) => {
                const cell = cellMap.get(`${lg.league_id}:${bt}`);
                const x = colX(j) + CELL_GAP / 2;
                const y = rowY + CELL_GAP / 2;
                const w = colW - CELL_GAP;
                const h = ROW_H - CELL_GAP;

                if (!cell) {
                  return (
                    <rect
                      key={bt}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={4}
                      fill="var(--color-bg-surface)"
                      opacity={0.3}
                    />
                  );
                }

                const insufficient = cell.insufficient_data || cell.win_ratio === null;
                const { color, l } = insufficient ? { color: '', l: 0 } : interpolateDiverging(cell.win_ratio!);
                const ink = inkFor(l);

                return (
                  <g
                    key={bt}
                    tabIndex={0}
                    role="button"
                    aria-label={
                      insufficient
                        ? `${lg.league_name} ${betTypeLabel(bt)}: ${t('arenaHeatmapCellInsufficientAria')}`
                        : `${lg.league_name} ${betTypeLabel(bt)}: ${Math.round(cell.win_ratio! * 100)}%`
                    }
                    onMouseEnter={() => setActive(cell)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(cell)}
                    onBlur={() => setActive(null)}
                    style={{ cursor: 'pointer', outline: 'none' }}
                  >
                    <title>
                      {lg.league_name} — {betTypeLabel(bt)}:{' '}
                      {insufficient ? t('arenaHeatmapCellInsufficientAria') : `${Math.round(cell.win_ratio! * 100)}%`}
                    </title>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={4}
                      fill={insufficient ? `url(#${patternId})` : color}
                      stroke={active === cell ? 'var(--color-border-bright)' : 'transparent'}
                      strokeWidth={1.5}
                    />
                    <text
                      x={x + w / 2}
                      y={y + h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={8.5}
                      fontFamily="'SF Mono', 'Roboto Mono', Menlo, monospace"
                      fontWeight={600}
                      fill={insufficient ? 'var(--color-text-muted)' : ink}
                    >
                      {insufficient ? '–' : `${Math.round(cell.win_ratio! * 100)}%`}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Legend — diverging colorbar with 0/50/100 ticks */}
        <g transform={`translate(${LABEL_W}, ${HEADER_H + leagues.length * ROW_H + 6})`}>
          <rect x={0} y={0} width={gridW} height={6} rx={3} fill={`url(#${patternId}-legend)`} />
          <text x={0} y={16} fontSize={6.5} fill="var(--color-text-muted)" textAnchor="start">0%</text>
          <text x={gridW / 2} y={16} fontSize={6.5} fill="var(--color-text-muted)" textAnchor="middle">50%</text>
          <text x={gridW} y={16} fontSize={6.5} fill="var(--color-text-muted)" textAnchor="end">100%</text>
        </g>
      </svg>

      {showTable && (
        <table className="w-full text-xs font-mono">
          <caption className="sr-only">{t('arenaHeatmapTitle')}</caption>
          <thead>
            <tr className="text-text-muted text-start">
              <th scope="col" className="text-start py-1 font-barlow font-normal">{t('arenaHeatmapColLeague')}</th>
              <th scope="col" className="text-start py-1 font-barlow font-normal">{t('arenaHeatmapColBetType')}</th>
              <th scope="col" className="text-start py-1 font-barlow font-normal">{t('arenaHeatmapColWinRate')}</th>
              <th scope="col" className="text-start py-1 font-barlow font-normal">{t('arenaHeatmapColSample')}</th>
            </tr>
          </thead>
          <tbody>
            {cells.map(c => (
              <tr key={`${c.league_id}:${c.bet_type}`} className="border-t border-border-subtle">
                <th scope="row" className="text-start py-1 font-normal text-text-primary">{c.league_name}</th>
                <td className="py-1 text-text-muted">{betTypeLabel(c.bet_type)}</td>
                <td className="py-1 text-text-primary">
                  {c.insufficient_data || c.win_ratio === null ? '–' : `${Math.round(c.win_ratio * 100)}%`}
                </td>
                <td className="py-1 text-text-muted">{c.sample_size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-1 min-h-[1.1rem] text-xs font-mono text-text-muted">
        {active &&
          (active.insufficient_data || active.win_ratio === null
            ? `${active.league_name} — ${betTypeLabel(active.bet_type)}: ${t('arenaHeatmapCellInsufficientAria')}`
            : `${active.league_name} — ${betTypeLabel(active.bet_type)}: ${Math.round(active.win_ratio * 100)}% (${active.sample_size})`)}
      </div>

      <button
        type="button"
        onClick={() => setShowTable(s => !s)}
        className="mt-1 text-[11px] font-barlow uppercase tracking-wide text-accent-green hover:underline"
      >
        {showTable ? t('arenaViewAsChart') : t('arenaViewAsTable')}
      </button>
    </div>
  );
}
