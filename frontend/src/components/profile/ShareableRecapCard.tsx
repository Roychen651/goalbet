import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { useUIStore } from '../../stores/uiStore';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { drawRecapCard, shareRecapCard } from '../../lib/shareCard';

interface ShareableRecapCardProps {
  onClose: () => void;
}

/**
 * Bottom-sheet modal (rule 4.13 — swipe-to-close, onPointerDown on the scroll
 * container) showing the on-screen recap preview + a Share button. The actual
 * shareable asset is drawn separately by shareCard.ts at share time (a
 * hand-built Canvas primitive, not a screenshot of this DOM).
 *
 * Deliberately promotes the app generally in the default share text, not the
 * group's invite code — a recap card is exactly the kind of asset that gets
 * forwarded past its original audience, and invite codes are private by
 * design (that's the whole point of the invite-code join model).
 */
export function ShareableRecapCard({ onClose }: ShareableRecapCardProps) {
  const { user, profile } = useAuthStore();
  const { lang, t } = useLangStore();
  const { addToast } = useUIStore();
  const { entries, loading } = useLeaderboard('total');
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isHe = lang === 'he';
  const mine = entries.find(e => e.user_id === user?.id);

  const handleShare = async () => {
    if (!mine || !profile) return;
    setSharing(true);
    try {
      const canvas = drawRecapCard({
        username: profile.username,
        rank: mine.rank,
        totalPoints: mine.total_points,
        streak: mine.current_streak,
        lang,
      });
      const shareText = isHe
        ? `אני מקום #${mine.rank} בליגת הניחושים שלי ב-GoalBet 🔥 בוא/י תנסה לנחש אותי — goalbet.io`
        : `I'm #${mine.rank} in my GoalBet prediction league 🔥 Think you can beat me? — goalbet.io`;

      const outcome = await shareRecapCard(canvas, shareText, 'GoalBet');
      if (outcome === 'shared-file' || outcome === 'shared-text') {
        addToast(t('shareRecapSharedToast'), 'success');
      } else if (outcome === 'copied') {
        addToast(t('shareRecapCopiedToast'), 'success');
      } else if (outcome === 'downloaded') {
        addToast(t('shareRecapDownloadedToast'), 'success');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 && info.velocity.y > 20) onClose();
        }}
      >
        <div className="card-elevated border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden">
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-text-muted/20" />
          </div>

          {/* Header */}
          <div className="relative px-5 pt-3 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bebas text-2xl tracking-wider text-white">{t('shareRecapTitle')}</h2>
                <p className="text-white/45 text-xs mt-0.5">{t('shareRecapSubtitle')}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all text-sm shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-4 py-4 max-h-[65vh] overflow-y-auto" onWheel={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            {loading || !mine ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent-green/40 border-t-accent-green rounded-full animate-spin" />
              </div>
            ) : (
              <div
                ref={cardRef}
                className="relative rounded-2xl overflow-hidden bento-hero-card border p-6 flex flex-col items-center text-center"
              >
                <div className="absolute -bottom-8 -start-8 w-36 h-36 rounded-full bento-hero-bloom blur-2xl pointer-events-none" />
                <span className="text-accent-green font-bold text-sm mb-1">GoalBet ⚽</span>
                <span className="text-white font-semibold text-lg mb-3">{profile?.username}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{t('shareRecapRankLabel')}</span>
                <span className="font-display font-bold text-6xl text-accent-green leading-none mb-4">#{mine.rank}</span>
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center">
                    <span className="font-display font-bold text-3xl text-white tabular-nums">{mine.total_points}</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{t('totalPoints')}</span>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div className="flex flex-col items-center">
                    <span className="font-display font-bold text-3xl text-accent-green tabular-nums">{mine.current_streak}🔥</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{t('bentoCurrentStreak')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-white/8">
            <button
              onClick={handleShare}
              disabled={sharing || loading || !mine}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-green text-bg-base font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <Share2 size={16} />
              {sharing ? '···' : t('shareRecapButton')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
