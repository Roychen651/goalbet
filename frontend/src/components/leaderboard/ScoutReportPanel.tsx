import { smoothPath } from '../../lib/svgPath';
import { TIER_COLORS } from '../../lib/tierVisuals';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

// V5 Sprint 40 — "The Scout Report": a NEW block appended to
// LeaderboardRow.tsx's EXISTING expand-in-place preview (Sprint 21, §36),
// not a second accordion. Reuses TIER_COLORS/DEBOSS_SHADOW (lib/tierVisuals.ts,
// the canonical 5-tier color system PredictionForm/HelpGuideModal already
// use) and smoothPath (lib/svgPath.ts, the one spline implementation every
// hand-built chart in this codebase shares) — zero new color system, zero
// new curve math, per this codebase's own extract-and-reuse discipline.

export interface TierRate {
  sample: number;
  correct: number;
}

export interface ScoutReportData {
  tier_success_rates: {
    result: TierRate;
    score: TierRate;
    corners: TierRate;
    btts: TierRate;
    ou: TierRate;
  };
  total_coins_staked: number;
  total_points_earned: number;
  efficiency: number | null;
  recent_trend: number[];
}

interface ScoutReportPanelProps {
  report: ScoutReportData | null;
  loading: boolean;
}

// Canonical tier order — matches TIER_COLORS' own fixed index order
// (Result / Score / Corners / BTTS / Over-Under), never re-sorted.
const TIER_ORDER: { key: keyof ScoutReportData['tier_success_rates']; labelKey: TranslationKey }[] = [
  { key: 'result', labelKey: 'tierResult' },
  { key: 'score', labelKey: 'tierScore' },
  { key: 'corners', labelKey: 'tierCorners' },
  { key: 'btts', labelKey: 'tierBTTS' },
  { key: 'ou', labelKey: 'tierOU' },
];

const MIN_SAMPLE = 3;

// Trend sparkline geometry — same static (no draw-on) treatment as
// LeaderboardRowSparkline, since several of these panels can be open
// simultaneously across a season-long table.
const VW = 120;
const VH = 28;
const PAD = 3;

export function ScoutReportPanel({ report, loading }: ScoutReportPanelProps) {
  const { t } = useLangStore();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2" role="status" aria-label={t('scoutReportLoading')}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="h-2 flex-1 rounded-full bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!report) return null;

  // Strongest tier by success ratio, MIN_SAMPLE-gated so a single lucky
  // corners pick can't crown a "מומחה קרנות" badge off a sample of one —
  // the same insufficient-sample honesty PredictionHeatmap already applies.
  let bestKey: (typeof TIER_ORDER)[number] | null = null;
  let bestRatio = -1;
  for (const tier of TIER_ORDER) {
    const rate = report.tier_success_rates[tier.key];
    if (rate.sample < MIN_SAMPLE) continue;
    const ratio = rate.correct / rate.sample;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestKey = tier;
    }
  }

  const trend = report.recent_trend;
  const hasTrend = trend && trend.length >= 2;
  let trendPath = '';
  let trendColor = 'var(--color-accent-green)';
  if (hasTrend) {
    const min = Math.min(...trend);
    const max = Math.max(...trend);
    const span = max - min || 1;
    const pts = trend.map((v, i) => ({
      x: (i / (trend.length - 1)) * VW,
      y: max === min ? VH / 2 : PAD + (1 - (v - min) / span) * (VH - PAD * 2),
    }));
    trendPath = smoothPath(pts);
    const slope = trend[trend.length - 1] - trend[0];
    trendColor = slope >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-orange)';
  }

  return (
    <div className="space-y-2.5 pt-1 border-t border-white/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-barlow">
          {t('scoutReportTitle')}
        </span>
        {bestKey && (
          <span
            className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border leading-none whitespace-nowrap', TIER_COLORS[TIER_ORDER.indexOf(bestKey)].pts)}
            style={{ borderColor: 'currentColor', background: 'color-mix(in oklch, currentColor 12%, transparent)' }}
          >
            {t('tierExpertBadge').replace('{0}', t(bestKey.labelKey))}
          </span>
        )}
      </div>

      {/* Tier success-rate bars — direct-labeled, never color-alone (dataviz
          skill's non-negotiable). sample < MIN_SAMPLE renders a hatched
          "–" state instead of a confident-looking color at a tiny n. */}
      <div className="space-y-1.5">
        {TIER_ORDER.map((tier, i) => {
          const rate = report.tier_success_rates[tier.key];
          const insufficient = rate.sample < MIN_SAMPLE;
          const pct = rate.sample > 0 ? Math.round((rate.correct / rate.sample) * 100) : 0;
          return (
            <div key={tier.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 shrink-0 text-text-muted truncate">{t(tier.labelKey)}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
                {insufficient ? (
                  <div
                    className="h-full w-full opacity-40"
                    style={{
                      background: 'repeating-linear-gradient(45deg, var(--color-text-muted) 0, var(--color-text-muted) 2px, transparent 2px, transparent 6px)',
                    }}
                  />
                ) : (
                  <div
                    className={cn('h-full rounded-full', TIER_COLORS[i].dot)}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span className={cn('w-8 shrink-0 text-end font-mono tabular-nums', insufficient ? 'text-text-muted/50' : TIER_COLORS[i].pts)}>
                {insufficient ? '–' : `${pct}%`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Efficiency + coins/points totals + trend, all font-mono tabular-nums
          per this codebase's own numeric-alignment convention. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-text-muted">{t('efficiencyIndexLabel')}</span>
            <span className="font-mono font-semibold tabular-nums text-white">
              {report.efficiency !== null ? report.efficiency.toFixed(2) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">{t('coinsStakedLabel')}</span>
            <span className="font-mono font-semibold tabular-nums text-white/80">{report.total_coins_staked}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">{t('pointsEarnedLabel')}</span>
            <span className="font-mono font-semibold tabular-nums text-accent-green">{report.total_points_earned}</span>
          </div>
        </div>

        {hasTrend && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-text-muted text-[10px]">{t('recentTrendLabel')}</span>
            <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{ direction: 'ltr' }} aria-hidden>
              <path
                d={trendPath}
                fill="none"
                stroke={trendColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="text-[10px]" style={{ color: trendColor }}>
              {trend[trend.length - 1] - trend[0] >= 0 ? '▲' : '▼'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
