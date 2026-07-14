import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { useGroupEvents, type GroupEvent } from '../../hooks/useGroupEvents';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../lib/utils';
import { CoinIcon } from '../ui/CoinIcon';
import type { TranslationKey } from '../../lib/i18n';

// ── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(iso: string, t: (k: TranslationKey) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return t('justNow');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('minsAgo').replace('{0}', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo').replace('{0}', String(hours));
  const days = Math.floor(hours / 24);
  return t('daysAgo').replace('{0}', String(days));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function outcomeLabel(
  outcome: unknown,
  isHe: boolean,
): string {
  if (outcome === 'H') return isHe ? 'ניצחון בית' : 'Home Win';
  if (outcome === 'D') return isHe ? 'תיקו' : 'Draw';
  if (outcome === 'A') return isHe ? 'ניצחון חוץ' : 'Away Win';
  return '';
}

function cornersLabel(val: unknown, isHe: boolean): string {
  if (val === 'under9') return isHe ? '≤9 קרנות' : '≤9 corners';
  if (val === 'ten') return isHe ? '10 בדיוק' : 'Exactly 10';
  if (val === 'over11') return isHe ? '≥11 קרנות' : '≥11 corners';
  return '';
}

// ── Stagger animation variants ───────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

// ── Main component ───────────────────────────────────────────────────────────

export function ActivityFeed() {
  const { t } = useLangStore();
  const { events, loading } = useGroupEvents();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent-green/40 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon="🏟️"
        title={t('lockerRoomEmpty')}
      />
    );
  }

  return (
    <div className="relative">
      {/* Glowing vertical timeline track */}
      <div
        className="absolute start-5 top-0 bottom-0 w-px"
        style={{
          background: 'linear-gradient(to bottom, var(--color-accent-green), transparent)',
          opacity: 0.2,
        }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} t={t} />
        ))}
      </motion.div>
    </div>
  );
}

// ── Individual event card ────────────────────────────────────────────────────

function EventCard({ event, t }: { event: GroupEvent; t: (k: TranslationKey) => string }) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';

  // AI banter has its own premium broadcast card — MICRO_BANTER (Sprint 14)
  // reuses it verbatim: same metadata shape (text_en/text_he/home_team/
  // away_team), same "AI Scout" visual identity, no reason for a second card.
  if (event.event_type === 'AI_BANTER' || event.event_type === 'MICRO_BANTER') {
    return <AiBanterCard event={event} t={t} />;
  }

  const isPrediction = event.event_type === 'PREDICTION_LOCKED';
  const isWon = event.event_type === 'WON_COINS';
  const meta = event.metadata;

  // Match info from joined data (matches table) — preferred over metadata
  const homeTeam = event.home_team || String(meta.home_team ?? '');
  const awayTeam = event.away_team || String(meta.away_team ?? '');
  const homeBadge = event.home_team_badge;
  const awayBadge = event.away_team_badge;
  const hasMatch = !!(homeTeam && awayTeam);

  // Glow styles per event type
  const glowClass = isPrediction
    ? 'shadow-[0_0_15px_rgba(96,165,250,0.18)] border-blue-400/20'
    : isWon
      ? 'shadow-[0_0_20px_rgba(var(--color-accent-green-rgb,189,232,245),0.25)] border-accent-green/30'
      : 'shadow-[0_0_15px_rgba(168,85,247,0.18)] border-purple-400/20';

  // Dot color
  const dotClass = isPrediction
    ? 'bg-blue-400 border-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.4)]'
    : isWon
      ? 'bg-accent-green border-accent-green/50 shadow-[0_0_8px_rgba(var(--color-accent-green-rgb,189,232,245),0.5)]'
      : 'bg-purple-400 border-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.4)]';

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'relative ps-10 pe-4 py-3.5',
        'rounded-2xl border backdrop-blur-xl',
        'bg-bg-card/60',
        'transition-all duration-300',
        glowClass,
        isWon && 'animate-pulse-subtle',
      )}
    >
      {/* Timeline dot */}
      <div className={cn('absolute start-3.5 top-5 w-3 h-3 rounded-full border-2 z-10', dotClass)} />

      {/* Header: avatar + name + time */}
      <div className="flex items-center gap-2.5 mb-2">
        <Avatar
          src={event.avatar_url}
          name={event.username ?? '?'}
          size="sm"
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary">
            {event.username}
          </span>
          <span className="text-text-muted text-xs ms-2">
            {timeAgo(event.created_at, t)}
          </span>
        </div>
      </div>

      {/* ── PREDICTION_LOCKED ─────────────────────────────────────────────── */}
      {isPrediction && (
        <div className="space-y-2">
          {/* Action line */}
          <p className="text-sm text-text-primary/80">
            🔒 {isHe ? 'נעל/ה ניחוש' : 'Locked a prediction'}
            {meta.tiers_count ? (
              <span className="text-text-muted text-xs ms-1">
                · {String(meta.tiers_count)} {isHe ? 'שלבים' : 'tiers'}
              </span>
            ) : null}
            {meta.coins_bet ? (
              <span className="text-amber-400 text-xs ms-1">
                · <CoinIcon size={13} className="inline-block align-[-1px] mx-0.5" />{String(meta.coins_bet)}
              </span>
            ) : null}
          </p>

          {/* Match strip */}
          {hasMatch && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/4 border border-white/6">
              {homeBadge && (
                <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
              <span className="text-text-muted text-[10px] font-barlow uppercase">vs</span>
              <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
              {awayBadge && (
                <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
            </div>
          )}

          {/* Prediction details — the gossip */}
          <div className="flex flex-wrap gap-1.5">
            {!!meta.predicted_outcome && (
              <PredictionChip
                label={outcomeLabel(meta.predicted_outcome, isHe)}
                color="blue"
              />
            )}
            {meta.predicted_home_score != null && meta.predicted_away_score != null && (
              <PredictionChip
                label={`${String(meta.predicted_home_score)}–${String(meta.predicted_away_score)}`}
                color="cyan"
              />
            )}
            {meta.predicted_btts != null && (
              <PredictionChip
                label={`BTTS ${meta.predicted_btts ? (isHe ? 'כן' : 'Yes') : (isHe ? 'לא' : 'No')}`}
                color="emerald"
              />
            )}
            {!!meta.predicted_over_under && (
              <PredictionChip
                label={meta.predicted_over_under === 'over' ? 'O2.5' : 'U2.5'}
                color="amber"
              />
            )}
            {!!meta.predicted_corners && (
              <PredictionChip
                label={cornersLabel(meta.predicted_corners, isHe)}
                color="purple"
              />
            )}
          </div>
        </div>
      )}

      {/* ── WON_COINS ─────────────────────────────────────────────────────── */}
      {isWon && (
        <div className="space-y-2">
          <p className="text-sm text-text-primary/80">
            💰 {isHe
              ? `לקח/ה ${String(meta.points ?? 0)} נק׳ ← ${String(meta.coins ?? 0)} מטבעות!`
              : `Scored ${String(meta.points ?? 0)} pts → won ${String(meta.coins ?? 0)} coins!`
            }
          </p>

          {/* Match strip */}
          {hasMatch && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent-green/5 border border-accent-green/10">
              {homeBadge && (
                <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
              <span className="text-text-muted text-[10px] font-barlow uppercase">vs</span>
              <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
              {awayBadge && (
                <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD_CLIMB ─────────────────────────────────────────────── */}
      {event.event_type === 'LEADERBOARD_CLIMB' && (
        <p className="text-sm text-text-primary/80">
          📈 {isHe
            ? `טיפס/ה למקום #${String(meta.rank ?? '?')}`
            : `Climbed to rank #${String(meta.rank ?? '?')}`
          }
        </p>
      )}
    </motion.div>
  );
}

// ── AI Provocateur banter card ───────────────────────────────────────────────
// Visually unmistakable vs human messages: rotating conic-gradient border, dark
// glass panel, gradient "AI Scout" identity with a Sparkles avatar and an "AI"
// pill. Lang-aware text from metadata; returns null if Groq produced nothing.

function AiBanterCard({ event, t }: { event: GroupEvent; t: (k: TranslationKey) => string }) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';
  const meta = event.metadata;
  const text = String((isHe && meta.text_he) || meta.text_en || '').trim();

  const homeTeam = event.home_team || String(meta.home_team ?? '');
  const awayTeam = event.away_team || String(meta.away_team ?? '');
  const homeBadge = event.home_team_badge;
  const awayBadge = event.away_team_badge;
  const hasMatch = !!(homeTeam && awayTeam);

  if (!text) return null;

  return (
    <motion.div variants={itemVariants} className="relative ps-10">
      {/* Timeline dot — AI gradient */}
      <div className="absolute start-3.5 top-5 w-3 h-3 rounded-full border-2 z-10 bg-violet-400 border-violet-300/50 shadow-[0_0_10px_rgba(167,139,250,0.6)]" />

      {/* Rotating conic-gradient border */}
      <div className="relative rounded-2xl p-[1.5px] overflow-hidden" dir={isHe ? 'rtl' : 'ltr'}>
        <motion.span
          aria-hidden
          className="absolute inset-[-55%]"
          style={{
            background:
              'conic-gradient(from 0deg,' +
              ' rgba(167,139,250,0.0) 0%,' +
              ' rgba(167,139,250,0.95) 14%,' +
              ' rgba(96,165,250,0.80) 34%,' +
              ' rgba(189,232,245,0.85) 52%,' +
              ' rgba(167,139,250,0.50) 70%,' +
              ' rgba(96,165,250,0.0) 86%,' +
              ' rgba(167,139,250,0.0) 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
        />

        {/* Dark glass panel */}
        <div
          className="relative rounded-[calc(1rem-1.5px)] backdrop-blur-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(6,10,22,0.82) 0%, rgba(12,10,26,0.80) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px -24px rgba(0,0,0,0.75)',
          }}
        >
          <div className="relative px-3.5 pt-2.5 pb-3">
            {/* Header: AI avatar + gradient name + AI pill + time */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)',
                  boxShadow: '0 0 12px rgba(167,139,250,0.5)',
                }}
              >
                <Sparkles size={15} className="text-white" />
              </div>
              <span
                className="text-sm font-bold"
                style={{
                  backgroundImage: 'linear-gradient(120deg, #A78BFA 0%, #BDE8F5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('lockerAiName')}
              </span>
              <span className="text-[9px] font-bold tracking-[0.18em] px-1.5 py-0.5 rounded-md border border-violet-400/40 text-violet-200 bg-violet-500/15">
                AI
              </span>
              <span className="text-text-muted text-xs ms-auto">{timeAgo(event.created_at, t)}</span>
            </div>

            {/* Banter */}
            <p className="text-[13.5px] leading-snug text-white/95 font-display">{text}</p>

            {/* Match strip */}
            {hasMatch && (
              <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/4 border border-white/8">
                {homeBadge && (
                  <img src={homeBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                )}
                <span className="text-xs font-medium text-text-primary truncate">{homeTeam}</span>
                <span className="text-text-muted text-[10px] font-barlow uppercase">vs</span>
                <span className="text-xs font-medium text-text-primary truncate">{awayTeam}</span>
                {awayBadge && (
                  <img src={awayBadge} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Prediction detail chip ───────────────────────────────────────────────────

const chipColors: Record<string, string> = {
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
};

function PredictionChip({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border',
      chipColors[color] ?? chipColors.blue,
    )}>
      {label}
    </span>
  );
}
