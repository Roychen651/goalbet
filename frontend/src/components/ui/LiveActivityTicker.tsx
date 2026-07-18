import { AnimatePresence, motion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { tg } from '../../lib/i18n';
import type { TickerEvent } from '../../hooks/useLiveReactions';

interface LiveActivityTickerProps {
  events: TickerEvent[];
}

/**
 * V5 Sprint 39 — "צנרת אירועים" (Live Activity Ticker). Renders inside
 * MatchCard's isLive block, via LiveLobby.tsx. In-memory-only, last 3
 * events — fed
 * straight from useLiveReactions' own component-scoped state, so it
 * resets for free the instant the match center closes (unmount), with no
 * separate clear-on-close code needed anywhere.
 */
export function LiveActivityTicker({ events }: LiveActivityTickerProps) {
  const { t } = useLangStore();

  // Hidden until real data exists — the same convention MatchTimeline /
  // AIScoutCard / PulseFeed already established (§21) rather than an
  // empty-state placeholder for a feed nobody's used yet.
  if (events.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-display">
          {t('liveLobbyTickerLabel')}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <AnimatePresence initial={false} mode="popLayout">
          {events.map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="text-xs font-mono tabular-nums text-white/65 truncate"
            >
              {tg(t, 'liveLobbySentReaction', e.gender).replace('{0}', e.username).replace('{1}', e.chip)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
