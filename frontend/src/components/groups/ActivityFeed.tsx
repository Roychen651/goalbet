import { motion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { useGroupEvents, type GroupEvent } from '../../hooks/useGroupEvents';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../lib/utils';
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

// ── Event card glow styles ───────────────────────────────────────────────────

const glowStyles: Record<GroupEvent['event_type'], string> = {
  WON_COINS:
    'shadow-[0_0_20px_rgba(var(--color-accent-green-rgb,189,232,245),0.25)] border-accent-green/30',
  PREDICTION_LOCKED:
    'shadow-[0_0_15px_rgba(96,165,250,0.2)] border-blue-400/25',
  LEADERBOARD_CLIMB:
    'shadow-[0_0_15px_rgba(168,85,247,0.2)] border-purple-400/25',
};

const iconMap: Record<GroupEvent['event_type'], string> = {
  PREDICTION_LOCKED: '🔒',
  WON_COINS: '💰',
  LEADERBOARD_CLIMB: '📈',
};

// ── Event text builder ───────────────────────────────────────────────────────

function buildEventText(event: GroupEvent, t: (k: TranslationKey) => string): string {
  const user = event.username ?? 'Someone';
  const meta = event.metadata;

  switch (event.event_type) {
    case 'PREDICTION_LOCKED': {
      const match = (meta.home_team && meta.away_team)
        ? `${meta.home_team} vs ${meta.away_team}`
        : '';
      return t('eventPredictionLocked')
        .replace('{user}', user)
        .replace('{match}', match || '⚽');
    }
    case 'WON_COINS': {
      const coins = String(meta.coins ?? 0);
      return t('eventWonCoins')
        .replace('{user}', user)
        .replace('{coins}', coins);
    }
    case 'LEADERBOARD_CLIMB': {
      const rank = String(meta.rank ?? '?');
      return t('eventLeaderboardClimb')
        .replace('{user}', user)
        .replace('{rank}', rank);
    }
    default:
      return '';
  }
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
  const isWon = event.event_type === 'WON_COINS';

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'relative flex items-start gap-3 ps-10 pe-4 py-3',
        'rounded-2xl border backdrop-blur-xl',
        'bg-bg-card/60',
        'transition-all duration-300',
        glowStyles[event.event_type],
        isWon && 'animate-pulse-subtle',
      )}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute start-3.5 top-4 w-3 h-3 rounded-full border-2',
          'z-10',
          event.event_type === 'WON_COINS' && 'bg-accent-green border-accent-green/50 shadow-[0_0_8px_rgba(var(--color-accent-green-rgb,189,232,245),0.5)]',
          event.event_type === 'PREDICTION_LOCKED' && 'bg-blue-400 border-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.4)]',
          event.event_type === 'LEADERBOARD_CLIMB' && 'bg-purple-400 border-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.4)]',
        )}
      />

      {/* Avatar */}
      <Avatar
        src={event.avatar_url}
        name={event.username ?? '?'}
        size="sm"
        className="shrink-0 mt-0.5"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-text-primary font-medium leading-snug">
            <span className="me-1.5">{iconMap[event.event_type]}</span>
            {buildEventText(event, t)}
          </p>
        </div>

        {/* Match context for WON_COINS */}
        {isWon && !!event.metadata.home_team && (
          <p className="text-xs text-text-muted mt-1 truncate">
            {String(event.metadata.home_team)} vs {String(event.metadata.away_team)}
            {event.metadata.points ? ` · ${String(event.metadata.points)} pts` : ''}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-[10px] font-barlow uppercase tracking-widest text-text-muted/60 mt-1">
          {timeAgo(event.created_at, t)}
        </p>
      </div>
    </motion.div>
  );
}
