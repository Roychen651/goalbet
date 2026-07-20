import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import type { LiveCommentaryEntry } from '../../lib/supabase';

interface LiveCommentaryFeedProps {
  entries: LiveCommentaryEntry[];
}

const TYPE_ICON: Record<LiveCommentaryEntry['type'], string> = {
  goal: '⚽',
  penalty_goal: '⚽',
  own_goal: '⚽',
  yellow_card: '🟨',
  red_card: '🟥',
  second_yellow: '🟥',
  substitution: '🔄',
};

/**
 * V6 Sprint 44 — a capped, fixed-max-height feed of AI-narrated live event
 * lines inside an expanded live MatchCard. Mirrors LiveActivityTicker.tsx's
 * established shape (§54) — capped list, AnimatePresence popLayout, hidden
 * until real data exists — rather than inventing a second feed pattern.
 * Newest entry gets a word-by-word typewriter reveal, the same stagger
 * shape HTAnalystCard.tsx already established for a live-broadcast-feeling
 * text reveal (§23) — reused, not reinvented.
 *
 * max-h + overflow-y-auto (not an unbounded growing list) is deliberate:
 * Sprint 44's own zero-CLS mandate means new entries must never push the
 * rest of the expanded card's content around as the feed grows.
 */
export function LiveCommentaryFeed({ entries }: LiveCommentaryFeedProps) {
  const { t, lang } = useLangStore();
  const reduceMotion = useReducedMotion();

  if (entries.length === 0) return null;

  // Newest first, capped — a live feed reads as "what just happened," not
  // a full match log (which already exists elsewhere, MatchTimeline).
  const recent = [...entries]
    .sort((a, b) => (b.minute - a.minute) || ((b.extra_time ?? 0) - (a.extra_time ?? 0)))
    .slice(0, 6);

  return (
    <div className="mt-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-display">
          {t('liveCommentaryLabel')}
        </span>
      </div>
      <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5" data-lenis-prevent onPointerDown={e => e.stopPropagation()}>
        <AnimatePresence initial={false} mode="popLayout">
          {recent.map((entry, i) => {
            const text = (lang === 'he' && entry.text_he) || entry.text_en;
            if (!text) return null;
            const minuteStr = entry.extra_time !== null ? `${entry.minute}+${entry.extra_time}'` : `${entry.minute}'`;
            const words = text.split(/\s+/);
            return (
              <motion.div
                key={entry.key}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex items-start gap-1.5 text-xs text-white/75"
              >
                <span className="font-mono tabular-nums text-white/40 shrink-0">{minuteStr}</span>
                <span className="shrink-0">{TYPE_ICON[entry.type]}</span>
                {i === 0 && !reduceMotion ? (
                  <span className="min-w-0">
                    {words.map((w, wi) => (
                      <motion.span
                        key={wi}
                        initial={{ opacity: 0, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        transition={{ delay: wi * 0.035, duration: 0.2 }}
                        className="inline-block me-1"
                      >
                        {w}
                      </motion.span>
                    ))}
                  </span>
                ) : (
                  <span className="min-w-0">{text}</span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
