import { motion } from 'framer-motion';
import { TiltCardV2 } from '../ui/TiltCardV2';
import { InfoTip } from '../ui/InfoTip';
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
    <div className="h-8 flex items-start gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans font-semibold text-white/35 leading-tight bento-label">
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
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  purple?: boolean;
  info?: string;
}) {
  return (
    <motion.div variants={ITEM} className="h-full">
      <TiltCardV2 maxRotate={3} className="h-full">
        <div className={cn(
          'h-full rounded-2xl border p-4 flex flex-col backdrop-blur-glass',
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
            <p className="text-white/30 text-[10px] font-sans mt-1 leading-tight bento-sub">
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
}: ProfileBentoV2Props) {
  const { t } = useLangStore();

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
      className="grid grid-cols-4 grid-rows-2 gap-3 auto-rows-fr"
      style={{ minHeight: '220px' }}
    >
      {/* ── Hero card: Total Points — 2×2 ─────────────────────────────────── */}
      <motion.div variants={ITEM} className="col-span-2 row-span-2">
        <TiltCardV2 maxRotate={3} className="h-full">
          <div className="h-full rounded-2xl border bento-hero-card backdrop-blur-glass p-5 flex flex-col justify-between relative overflow-hidden">
            {/* Ambient bloom */}
            <div className="absolute -bottom-8 -start-8 w-36 h-36 rounded-full bento-hero-bloom blur-2xl pointer-events-none" />

            <Label>{t('totalPoints')}</Label>

            <div>
              <HeroNumber
                value={totalPoints}
                className="text-5xl sm:text-6xl text-accent-green"
              />
              {avgPts && (
                <p className="text-white/35 text-xs font-sans mt-1.5 bento-sub">
                  {avgPts} {t('avgLabel')} · {resolved} {t('resolvedLabel')}
                </p>
              )}
            </div>

            {/* Micro-sparkline */}
            <div className="flex items-end gap-1 h-8 mt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-accent-green/20"
                  style={{ height: `${30 + Math.sin(i * 1.4) * 50}%` }}
                />
              ))}
            </div>
          </div>
        </TiltCardV2>
      </motion.div>

      {/* ── FT Win Rate — top-right ────────────────────────────────────────── */}
      <MicroCard
        label={t('bentoFtWinRate')}
        value={hitRatePct !== null ? `${hitRatePct}%` : '—'}
        sub={ftTotal > 0 ? `${ftHits} / ${ftTotal} ${t('bentoOfCorrect')}` : t('noLeaderboardData')}
        accent
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
