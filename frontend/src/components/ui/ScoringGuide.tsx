import { motion, AnimatePresence } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';

interface ScoringGuideProps {
  onClose: () => void;
}

// Max 19 pts/match + streak bonus
// Tier1(3) + Tier2(7) + Tier3(4) + Tier5(2) + Tier6(3) = 19
const TIERS = [
  {
    emoji: '🎯',
    label: 'Full Time Result',
    labelHe: 'תוצאה סופית',
    pts: 3,
    detail: 'Pick Home / Draw / Away',
    detailHe: 'בחר: בית / תיקו / חוץ',
    color: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]',
  },
  {
    emoji: '🎰',
    label: 'Exact Score',
    labelHe: 'תוצאה מדויקת',
    pts: 7,
    detail: '+7 pts stacks on top of tier 1 → up to 10 pts',
    detailHe: '+7 נק׳ על גבי תוצאה → עד 10 נק׳ יחד',
    color: 'from-yellow-500/20 to-amber-600/10',
    border: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.15)]',
  },
  {
    emoji: '⏱️',
    label: 'Half Time Result',
    labelHe: 'תוצאת הפסקה',
    pts: 4,
    detail: 'Predict the result at half time',
    detailHe: 'נבא את התוצאה בהפסקה',
    color: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    textColor: 'text-blue-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
  {
    emoji: '⚽',
    label: 'Both Teams Score',
    labelHe: 'שתי הקבוצות מבקיעות',
    pts: 2,
    detail: 'Will both teams score at least 1 goal?',
    detailHe: 'האם שתי הקבוצות יבקיעו לפחות שער?',
    color: 'from-orange-500/20 to-orange-600/10',
    border: 'border-orange-500/30',
    textColor: 'text-orange-400',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]',
  },
  {
    emoji: '📊',
    label: 'Over / Under 2.5',
    labelHe: 'מעל / מתחת 2.5 שערים',
    pts: 3,
    detail: 'More or fewer than 2.5 total goals?',
    detailHe: 'האם יהיו יותר או פחות מ-2.5 שערים?',
    color: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/30',
    textColor: 'text-purple-400',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
  },
];

export function ScoringGuide({ onClose }: ScoringGuideProps) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient glow behind card */}
        <div className="absolute -inset-4 rounded-3xl bg-accent-green/5 blur-2xl pointer-events-none" />

        <div className="relative rounded-2xl bg-[#0f1a14] border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 border-b border-white/8">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-green/8 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🏆</span>
                  <h2 className="font-bebas text-2xl tracking-wider text-white">
                    {isHe ? 'מערכת הניקוד' : 'Scoring System'}
                  </h2>
                </div>
                <p className="text-text-muted text-xs">
                  {isHe ? 'עד 19 נקודות למשחק + בונוס רצף' : 'Up to 19 pts per match + streak bonus'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/15 flex items-center justify-center text-text-muted hover:text-white hover:bg-white/15 transition-all text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tiers */}
          <div className="px-4 py-3 space-y-2 max-h-[55vh] overflow-y-auto">
            {TIERS.map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: isHe ? 16 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 120, damping: 18 }}
                className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${tier.color} border ${tier.border} ${tier.glow}`}
              >
                <span className="text-xl shrink-0">{tier.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">
                    {isHe ? tier.labelHe : tier.label}
                  </p>
                  <p className="text-text-muted text-xs mt-0.5 leading-relaxed">
                    {isHe ? tier.detailHe : tier.detail}
                  </p>
                </div>
                <div className={`shrink-0 font-bebas text-2xl ${tier.textColor} tabular-nums`}>
                  +{tier.pts}
                </div>
              </motion.div>
            ))}

            {/* Streak bonus */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 100 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-600/10 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
            >
              <span className="text-xl shrink-0">🔥</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">
                  {isHe ? 'בונוס רצף' : 'Streak Bonus'}
                </p>
                <p className="text-text-muted text-xs mt-0.5 leading-relaxed">
                  {isHe
                    ? '3 ניחושים נכונים ברצף → כל ניחוש נוסף מוסיף 2 נק׳'
                    : '3 correct in a row → every additional correct pick adds +2'}
                </p>
              </div>
              <div className="shrink-0 font-bebas text-2xl text-orange-400 tabular-nums">+2</div>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
            className="px-5 py-3 border-t border-white/8 flex items-center justify-between bg-white/3"
          >
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span>🔒</span>
              <span>{isHe ? 'ננעל 15 דק׳ לפני הקיקאוף' : 'Locks 15 min before kickoff'}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-text-muted">{isHe ? 'מקסימום' : 'Max'}</span>
              <span className="font-bebas text-base text-accent-green">19 pts</span>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
