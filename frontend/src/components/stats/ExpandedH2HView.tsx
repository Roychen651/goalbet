import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { Avatar } from '../ui/Avatar';
import type { ArenaH2HRow } from '../../hooks/useStatsArena';
import { tTeam } from '../../lib/dictionaries/teamsHe';

interface ExpandedH2HViewProps {
  row: ArenaH2HRow;
  onClose: () => void;
}

function scoreLabel(home: number | null, away: number | null): string {
  return home == null || away == null ? '–' : `${home}–${away}`;
}

/**
 * Sprint 16 — the morphing destination for H2HMatrix's comparison panel.
 * Mounted via createPortal into #portal-root (index.html) rather than
 * rendered in place: GlassCard's tactile-tilt transform (Sprint 16 Commit 1)
 * creates a new CSS containing block on the collapsed card, which would
 * otherwise clip a position:fixed descendant to the card's own
 * overflow-hidden bounds — a real portal escapes that regardless of any
 * ancestor's transform/overflow.
 *
 * Shares layoutId={`h2h-panel-${row.opponent_id}`} with the collapsed panel
 * in H2HMatrix.tsx — Framer Motion's shared-layout projection animates this
 * element's mount FROM the collapsed panel's last known position/size. React
 * context (including Framer's LayoutGroup context) propagates through
 * createPortal even though the DOM node is elsewhere, so no extra wiring is
 * needed for the layoutId match to resolve across the portal boundary.
 */
export function ExpandedH2HView({ row, onClose }: ExpandedH2HViewProps) {
  const { t, lang } = useLangStore();
  const isHe = lang === 'he';
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;

  return createPortal(
    <>
      {/* Backdrop — opacity-only fade, deliberately no layoutId (only the
          card itself morphs; the dimming behind it is a separate concern) */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        layoutId={`h2h-panel-${row.opponent_id}`}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed inset-x-4 top-[8vh] bottom-[8vh] z-50 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:w-full sm:max-w-lg rounded-2xl overflow-hidden card-elevated border border-white/10 flex flex-col"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {/* Content crossfades in slightly after the container spring starts
            — simultaneous crossfade-during-morph is what makes a shared
            layout transition read as jittery instead of premium. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.25 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="flex flex-col h-full min-h-0"
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar src={row.avatar_url} name={row.username} size="md" />
              <div className="min-w-0">
                <p className="font-barlow font-bold text-base text-text-primary truncate">{row.username}</p>
                <p className="font-mono text-xs text-text-muted">
                  {t('you')} {row.user_points} — {row.opponent_points} {row.username}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <p className="px-4 pt-3 pb-1 font-barlow text-[11px] font-bold uppercase tracking-widest text-text-muted shrink-0">
            {t('arenaH2HMatchHistoryTitle')}
          </p>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4" data-lenis-prevent onPointerDown={e => e.stopPropagation()}>
            {row.match_details.map(m => (
              <div key={m.match_id} className="flex flex-col gap-1 py-2.5 border-b border-white/8 last:border-b-0">
                <div className="flex items-center justify-between text-[10px] text-text-muted font-barlow uppercase tracking-wide">
                  <span className="truncate">{m.league_name}</span>
                  <span className="shrink-0 ms-2">
                    {new Date(m.kickoff_time).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-text-primary">
                    {lang === 'he' ? `${tTeam(m.home_team)} – ${tTeam(m.away_team)}` : `${m.home_team} – ${m.away_team}`}
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-text-primary tabular-nums">
                    {t('arenaH2HFinal')} {scoreLabel(m.home_score, m.away_score)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-text-muted tabular-nums">
                  <span className="truncate">
                    {t('you')}: {scoreLabel(m.user_predicted_home, m.user_predicted_away)} ({m.user_points}pts)
                  </span>
                  <span className="truncate">
                    {row.username}: {scoreLabel(m.opponent_predicted_home, m.opponent_predicted_away)} ({m.opponent_points}pts)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </>,
    portalRoot,
  );
}
