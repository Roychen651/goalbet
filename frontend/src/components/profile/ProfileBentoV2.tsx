import { motion, useReducedMotion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { TiltCardV2 } from '../ui/TiltCardV2';
import { InfoTip } from '../ui/InfoTip';
import { Sparkline } from '../ui/Sparkline';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';

interface ProfileBentoV2Props {
  totalPoints:    number;
  predictions:    number;
  resolved:       number;
  ftHits:         number;
  ftTotal:        number;
  currentStreak:  number;
  avgGoalsDiff:   number | null;
  exactScoreCount: number;
  /** Cumulative points over resolved predictions (chronological) — hero sparkline. */
  trajectory:     number[];
}

const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1,   transition: { type: 'spring' as const, stiffness: 120, damping: 18 } },
};

// ─── Shared label — fixed h-8 so numbers always align at the same vertical offset ──
function Label({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <div className="h-8 flex items-start gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans font-semibold text-white/35 leading-tight bento-label truncate min-w-0">
        {children}
      </span>
      {info && <InfoTip text={info} />}
    </div>
  );
}

// ─── Big hero number ──────────────────────────────────────────────────────────
function HeroNumber({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn('font-display font-bold leading-none tabular-nums', className)}>
      {value}
    </span>
  );
}

// ─── Micro stat box ───────────────────────────────────────────────────────────
function MicroCard({
  label,
  value,
  sub,
  accent = false,
  purple = false,
  info,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  purple?: boolean;
  info?: string;
  /** V5 Sprint 41 — grid span override (e.g. `sm:col-span-3` for a medium
   *  cell). Defaults to whatever the grid's implicit 1x1 auto-placement
   *  gives it — every existing call site is unaffected unless it opts in. */
  className?: string;
}) {
  return (
    <motion.div variants={ITEM} className={cn('h-full', className)}>
      <TiltCardV2 maxRotate={3} className="h-full">
        <div className={cn(
          'h-full rounded-2xl border p-4 flex flex-col backdrop-blur-glass overflow-hidden',
          accent  ? 'bento-card-accent'  :
          purple  ? 'bento-card-purple'  :
                    'bento-card-default',
        )}>
          <Label info={info}>{label}</Label>
          <HeroNumber
            value={value}
            className={cn(
              'text-3xl mt-2',
              accent ? 'text-accent-green' : purple ? 'text-[#7B61FF] bento-purple-value' : 'text-white bento-default-value',
            )}
          />
          {sub && (
            <p className="text-white/30 text-[10px] font-sans mt-1 leading-tight bento-sub truncate">
              {sub}
            </p>
          )}
        </div>
      </TiltCardV2>
    </motion.div>
  );
}

// ─── ProfileBentoV2 ───────────────────────────────────────────────────────────
export function ProfileBentoV2({
  totalPoints,
  predictions,
  resolved,
  ftHits,
  ftTotal,
  currentStreak,
  avgGoalsDiff,
  exactScoreCount,
  trajectory,
}: ProfileBentoV2Props) {
  const { t } = useLangStore();
  const reduceMotion = useReducedMotion();

  const hitRatePct = ftTotal > 0 ? Math.round((ftHits / ftTotal) * 100) : null;
  const avgPts = resolved > 0 ? (totalPoints / resolved).toFixed(1) : null;

  const precisionLabel =
    avgGoalsDiff === null      ? '—'
    : avgGoalsDiff < 1.0       ? t('bentoSharp')
    : avgGoalsDiff < 2.0       ? t('bentoDecent')
    : t('bentoRough');

  return (
    <motion.div
      variants={STAGGER}
      initial="hidden"
      animate="show"
      // V5 Sprint 41 — 6-column desktop grid (was 4) so a genuine 3-tier
      // size hierarchy fits without leftover cells: hero (half-width, full
      // height) > FT Win Rate (half-width, half-height — a real "medium"
      // cell, layout-grid-breaking's own recommended shape, promoted off
      // this app's own headline "hit rate" stat, §16) > the 3 remaining
      // micro cards (1/6 width each). Row math: row1 = hero(3) + FT(3) = 6;
      // row2 = hero(3, row-span-2) + Predictions(1) + Streak(1) +
      // ScorePrecision(1) = 6. No implicit row 3, no overflow. Mobile
      // (grid-cols-2) is completely unchanged from before this sprint.
      className="grid grid-cols-2 sm:grid-cols-6 gap-3 auto-rows-fr"
      style={{ minHeight: '220px' }}
    >
      {/* ── Hero card: Total Points — half-width, full-height ─────────────── */}
      <motion.div variants={ITEM} className="col-span-2 sm:col-span-3 sm:row-span-2">
        <TiltCardV2 maxRotate={3} className="h-full">
          <div className="h-full rounded-2xl border bento-hero-card backdrop-blur-glass p-5 flex flex-col justify-between relative overflow-hidden">
            {/* Ambient bloom — V5 Sprint 41 adds a slow breathing opacity/
                scale loop (the same "single instance -> Framer, many
                instances -> CSS" split already applied to LeaderboardRow's
                rank-1 halo and the streak-tier avatar halo, §22/§37). This
                card renders exactly once per page, so the "many
                simultaneous instances" cost concern that justifies a CSS
                @keyframes elsewhere doesn't apply here. Deliberately
                opacity/scale only (GPU-composited, rule per motion-
                microinteractions) — never width/height/top, and never
                combined with backdrop-filter on the SAME transformed
                element (this div has no blur of its own; the ancestor's
                backdrop-blur-glass is a separate, untransformed layer —
                the exact WebKit failure mode already fixed once in this
                app, §21/§34, deliberately not reintroduced here). */}
            <motion.div
              aria-hidden
              className="absolute -bottom-8 -start-8 w-36 h-36 rounded-full bento-hero-bloom blur-2xl pointer-events-none"
              animate={reduceMotion ? { opacity: 0.5 } : { opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
              transition={reduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />

            <Label>{t('totalPoints')}</Label>

            <div>
              <span className="font-display font-bold leading-none tabular-nums text-5xl sm:text-6xl text-accent-green">
                <NumberFlow
                  value={totalPoints}
                  transformTiming={{ duration: 700, easing: 'cubic-bezier(0.16,1,0.3,1)' }}
                />
              </span>
              {avgPts && (
                <p className="text-white/35 text-xs font-sans mt-1.5 bento-sub">
                  {avgPts} {t('avgLabel')} · {resolved} {t('resolvedLabel')}
                </p>
              )}
            </div>

            {/* Live points trajectory — real cumulative curve (replaces the old
                placeholder bars). Themed via CSS vars, draws on with Framer Motion. */}
            <Sparkline data={trajectory} tone="accent" height={32} className="mt-3" label={t('trajectoryLabel')} />
          </div>
        </TiltCardV2>
      </motion.div>

      {/* ── FT Win Rate — medium cell, top-right (Sprint 41: promoted from
          an equal 1x1 micro card to a genuine "medium" tier — this app's
          own headline stat, §16's hitRate tooltip: "the most important
          stat in football prediction" — matching layout-grid-breaking's
          own recommended one-hero-two-or-three-medium-cells shape). ──── */}
      <MicroCard
        label={t('bentoFtWinRate')}
        value={hitRatePct !== null ? `${hitRatePct}%` : '—'}
        sub={ftTotal > 0 ? `${ftHits} / ${ftTotal} ${t('bentoOfCorrect')}` : t('noLeaderboardData')}
        accent
        className="sm:col-span-3"
      />

      {/* ── Predictions — top-far-right ────────────────────────────────────── */}
      <MicroCard
        label={t('predictions')}
        value={predictions}
        sub={`${resolved} ${t('resolvedLabel')}`}
      />

      {/* ── Streak — bottom-right ─────────────────────────────────────────── */}
      <MicroCard
        label={t('bentoCurrentStreak')}
        value={currentStreak > 0 ? `${currentStreak}🔥` : currentStreak}
        sub={t('bentoConsecutiveCorrect')}
        purple
      />

      {/* ── Score Precision — bottom-far-right ────────────────────────────── */}
      <MicroCard
        label={t('scorePrecision')}
        value={avgGoalsDiff !== null ? `±${avgGoalsDiff.toFixed(1)}` : '—'}
        sub={avgGoalsDiff !== null ? `${precisionLabel} · ${exactScoreCount} ${t('bentoExact')}` : t('bentoPredictToSee')}
        purple
        info={t('infoScorePrecision')}
      />
    </motion.div>
  );
}
