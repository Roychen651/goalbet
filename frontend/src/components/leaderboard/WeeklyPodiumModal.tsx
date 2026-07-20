import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { Share2, Trophy } from 'lucide-react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useLangStore } from '../../stores/langStore';
import { useUIStore } from '../../stores/uiStore';
import { CosmeticAvatar } from '../ui/CosmeticAvatar';
import { PODIUM_STYLES } from '../../lib/podiumVisuals';
import { celebrateAt } from '../../lib/celebrate';
import { drawRecapCard, shareRecapCard } from '../../lib/shareCard';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

interface WeeklyPodiumModalProps {
  currentUserId: string;
  onClose: () => void;
}

/**
 * V6 Sprint 46 — "Hall of Champions." Manual trigger only this sprint
 * (auto-reveal at matchweek rollover deferred — see CLAUDE.md §61). Data:
 * useLeaderboard('weekly')'s own top 3, zero new query/migration — this
 * hook only mounts (and therefore only fetches/subscribes) while this
 * modal is actually open.
 *
 * Shell copies H2HModal.tsx's exact proven shape (createPortal, static
 * bg-black/80 + backdrop-blur-md backdrop, spring-entrance motion.div
 * wrapping a plain `card-elevated` child) — a shape that already coexists
 * safely with a transformed ancestor in this exact codebase.
 *
 * Takes no `groupId` prop — useLeaderboard() already reads the active group
 * from useGroupStore() internally, the exact same shape ShareableRecapCard
 * already relies on. A groupId prop here would just be dead weight (caught
 * during this sprint's own verification pass, not shipped unused).
 *
 * Podium cards: `transformPerspective`/`transformStyle: 'preserve-3d'` +
 * ONE-SHOT `rotateX` mount entrance + `backdrop-blur` glass, verified
 * against WorldCupBracket.tsx's GroupCard/StadiumCard — real, currently-
 * shipping precedent for exactly this combination. The documented WebKit
 * paint-failure trap (§21/§34) is specifically about a CONTINUOUS/
 * interactive transform (a drag gesture, Lenis-driven scroll positioning)
 * sharing an element with backdrop-filter/mix-blend-mode — a one-shot
 * settle-and-done mount animation is a different, proven-safe case. No
 * pointer-tracked tilt (useTactileTilt) is added to these cards for
 * exactly this reason — that WOULD be the continuously-updating category.
 */
export function WeeklyPodiumModal({ currentUserId, onClose }: WeeklyPodiumModalProps) {
  const { entries, loading } = useLeaderboard('weekly');
  const { t, lang } = useLangStore();
  const { addToast } = useUIStore();
  const reduceMotion = useReducedMotion();
  const [sharing, setSharing] = useState(false);
  const championRef = useRef<HTMLDivElement>(null);
  const burstFiredRef = useRef(false);

  const top3 = entries.slice(0, 3);
  const champion = top3[0];

  useEffect(() => {
    if (!loading && champion && !burstFiredRef.current) {
      burstFiredRef.current = true;
      celebrateAt(championRef.current);
    }
  }, [loading, champion]);

  const handleShare = async () => {
    if (!champion) return;
    setSharing(true);
    try {
      const canvas = drawRecapCard({
        username: champion.username,
        rank: 1,
        totalPoints: champion.weekly_points ?? 0,
        streak: champion.current_streak,
        lang,
      });
      const shareText = lang === 'he'
        ? `${champion.username} אלוף/ת השבוע ב-GoalBet עם ${champion.weekly_points ?? 0} נקודות! 🏆 goalbet.io`
        : `${champion.username} is this week's GoalBet champion with ${champion.weekly_points ?? 0} points! 🏆 goalbet.io`;
      const outcome = await shareRecapCard(canvas, shareText, 'GoalBet');
      if (outcome === 'shared-file' || outcome === 'shared-text') addToast(t('shareRecapSharedToast'), 'success');
      else if (outcome === 'copied') addToast(t('shareRecapCopiedToast'), 'success');
      else if (outcome === 'downloaded') addToast(t('shareRecapDownloadedToast'), 'success');
    } finally {
      setSharing(false);
    }
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 48, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-2xl card-elevated border border-white/10 overflow-hidden flex flex-col" style={{ maxHeight: 'min(88vh, calc(100svh - 2rem))' }}>

          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/8 shrink-0 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bebas text-2xl tracking-wider text-white flex items-center gap-2">
                <Trophy size={20} className="text-amber-400" />
                {t('podiumTitle')}
              </h2>
              <p className="text-white/45 text-xs mt-0.5">{t('podiumSubtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all text-sm shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-6 overflow-y-auto" onWheel={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent-green/40 border-t-accent-green rounded-full animate-spin" />
              </div>
            ) : top3.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-10">{t('podiumEmpty')}</p>
            ) : (
              // Fixed physical order (2nd-left, 1st-center, 3rd-right) — a
              // real podium's arrangement is a physical/graphic fact, not
              // reading-direction content, so it's pinned LTR the same way
              // this codebase's hand-built SVG chart axes already are
              // (§21/§47/§60). Every TEXT element inside each slot still
              // renders in its own natural language direction.
              <div className="flex items-end justify-center gap-3" style={{ direction: 'ltr' }}>
                {[top3[1], top3[0], top3[2]].map((entry, i) => {
                  if (!entry) return <div key={`empty-${i}`} className="flex-1" />;
                  const rank = entry.rank;
                  const isChamp = rank === 1;
                  const podium = PODIUM_STYLES[rank];
                  return (
                    <motion.div
                      key={entry.user_id}
                      ref={isChamp ? championRef : undefined}
                      initial={{ opacity: 0, y: 40, rotateX: 15, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                      transition={{ delay: i * 0.12, type: 'spring', stiffness: 220, damping: 22 }}
                      style={{ transformPerspective: 1000, transformStyle: 'preserve-3d' }}
                      className={cn(
                        'relative flex-1 rounded-2xl border overflow-hidden backdrop-blur-2xl flex flex-col items-center px-3 py-4',
                        isChamp
                          ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/12 to-transparent pt-6 pb-5'
                          : 'border-white/10 bg-white/[0.03]',
                      )}
                    >
                      {isChamp && (
                        <>
                          {/* Gold ambient glow — filter:blur, not backdrop-filter,
                              a decorative radial layer distinct from the card's
                              own glass surface above. */}
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -z-10 inset-0 -m-6 rounded-full blur-2xl"
                            style={{ background: 'radial-gradient(circle, var(--risk-gold) 0%, transparent 70%)', opacity: 0.35 }}
                          />
                          {/* Specular sweep — mix-blend-mode alone (no
                              backdrop-filter on the SAME element), matching
                              HallOfFameChronicles' ChronicleCard, the
                              real precedent for this exact combination
                              alongside a 3D-transformed card. */}
                          {!reduceMotion && (
                            <motion.div
                              aria-hidden
                              className="pointer-events-none absolute inset-0"
                              style={{ mixBlendMode: 'screen', background: 'linear-gradient(115deg, transparent 30%, rgba(255,201,74,0.35) 48%, transparent 66%)', backgroundSize: '250% 250%' }}
                              animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
                              transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                            />
                          )}
                        </>
                      )}

                      <span className="text-2xl mb-1.5">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
                      <CosmeticAvatar
                        src={entry.avatar_url}
                        name={entry.username}
                        size={podium?.avatarSize ?? 'md'}
                        activeCosmetics={entry.active_cosmetics}
                        className={cn(podium?.ring, podium?.shadow)}
                      />
                      <span className={cn(
                        'text-xs font-semibold mt-2 text-center truncate max-w-full',
                        entry.user_id === currentUserId ? 'text-accent-green' : 'text-white',
                      )}>
                        {entry.username}
                      </span>
                      <span className={cn('font-mono font-bold tabular-nums mt-0.5', isChamp ? 'text-xl text-amber-300' : 'text-base text-white/80')}>
                        <NumberFlow value={entry.weekly_points ?? 0} />
                      </span>
                      <span className="text-[9px] text-white/35 uppercase tracking-widest">{t('pts')}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {champion && (
            <div className="px-4 py-3 border-t border-white/8 shrink-0">
              <motion.button
                onClick={() => { haptic('selection'); void handleShare(); }}
                disabled={sharing}
                whileTap={sharing ? undefined : { scale: 0.95, rotate: -0.5, transition: { type: 'spring', stiffness: 500, damping: 15 } }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-bg-base font-semibold text-sm disabled:opacity-50"
              >
                <Share2 size={16} />
                {sharing ? '···' : t('podiumShareCta')}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
