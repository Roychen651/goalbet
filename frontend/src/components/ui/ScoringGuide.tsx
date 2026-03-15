import { motion, AnimatePresence } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';

interface ScoringGuideProps {
  onClose: () => void;
}

const TIERS = [
  {
    emoji: '🎯',
    label: 'Full Time Result',
    labelHe: 'תוצאה סופית',
    pts: 3,
    detail: 'Pick Home win / Draw / Away win',
    detailHe: 'בחר: ניצחון בית / תיקו / ניצחון חוץ',
    color: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    pillBg: 'bg-emerald-400/10',
  },
  {
    emoji: '🎰',
    label: 'Exact Score',
    labelHe: 'תוצאה מדויקת',
    pts: 7,
    detail: 'Stacks with Result → 3+7 = 10 pts combined',
    detailHe: 'מצטבר עם תוצאה → 3+7 = 10 נק׳ יחד',
    color: 'from-yellow-500/20 to-amber-600/10',
    border: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    pillBg: 'bg-yellow-400/10',
  },
  {
    emoji: '⏱️',
    label: 'Half Time Result',
    labelHe: 'תוצאת הפסקה',
    pts: 4,
    detail: 'Predict who leads at the whistle',
    detailHe: 'מי ינהיג בשריקת ההפסקה',
    color: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    textColor: 'text-blue-400',
    pillBg: 'bg-blue-400/10',
  },
  {
    emoji: '⚽',
    label: 'Both Teams Score',
    labelHe: 'שתי הקבוצות מבקיעות',
    pts: 2,
    detail: 'Will both sides score at least 1 goal?',
    detailHe: 'האם שתי הקבוצות יבקיעו לפחות שער?',
    color: 'from-orange-500/20 to-orange-600/10',
    border: 'border-orange-500/30',
    textColor: 'text-orange-400',
    pillBg: 'bg-orange-400/10',
  },
  {
    emoji: '📊',
    label: 'Over / Under 2.5',
    labelHe: 'מעל / מתחת 2.5',
    pts: 3,
    detail: 'Total goals in the match — over or under 2.5?',
    detailHe: 'האם יהיו יותר או פחות מ-2.5 שערים?',
    color: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/30',
    textColor: 'text-purple-400',
    pillBg: 'bg-purple-400/10',
  },
];

export function ScoringGuide({ onClose }: ScoringGuideProps) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Always-dark modal regardless of app theme */}
        <div className="bg-[#0c1610] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden">

          {/* Ambient gradient */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full"
              style={{ background: 'radial-gradient(ellipse, rgba(0,255,135,0.08) 0%, transparent 70%)', filter: 'blur(20px)' }} />
          </div>

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="relative px-5 pt-3 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <motion.span
                    animate={{ rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="text-2xl"
                  >
                    🏆
                  </motion.span>
                  <h2 className="font-bebas text-2xl tracking-wider text-white">
                    {isHe ? 'מערכת הניקוד' : 'Scoring System'}
                  </h2>
                </div>
                <p className="text-white/45 text-xs">
                  {isHe ? 'עד 19 נקודות למשחק + בונוס רצף' : 'Up to 19 pts per match + streak bonus'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all text-sm shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tiers list */}
          <div className="px-4 py-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
            {TIERS.map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: isHe ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.055, type: 'spring', stiffness: 200, damping: 22 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r ${tier.color} border ${tier.border}`}
              >
                <span className="text-lg shrink-0">{tier.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">
                    {isHe ? tier.labelHe : tier.label}
                  </p>
                  <p className="text-white/45 text-xs mt-0.5 leading-snug">
                    {isHe ? tier.detailHe : tier.detail}
                  </p>
                </div>
                <div className={`shrink-0 ${tier.pillBg} border ${tier.border} rounded-lg px-2.5 py-1`}>
                  <span className={`font-bebas text-xl ${tier.textColor} tabular-nums leading-none`}>+{tier.pts}</span>
                </div>
              </motion.div>
            ))}

            {/* Streak bonus */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, type: 'spring', stiffness: 140 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-red-500/15 to-orange-600/10 border border-red-500/25"
            >
              <motion.span
                className="text-lg shrink-0"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              >
                🔥
              </motion.span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">
                  {isHe ? 'בונוס רצף' : 'Streak Bonus'}
                </p>
                <p className="text-white/45 text-xs mt-0.5 leading-snug">
                  {isHe
                    ? '3 ניחושים נכונים ברצף → כל ניחוש נוסף = +2 נק׳'
                    : '3 correct in a row → each extra correct pick = +2 pts'}
                </p>
              </div>
              <div className="shrink-0 bg-orange-400/10 border border-orange-500/25 rounded-lg px-2.5 py-1">
                <span className="font-bebas text-xl text-orange-400 leading-none">+2</span>
              </div>
            </motion.div>
          </div>

          {/* Example calculation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mx-4 mb-3 px-3.5 py-2.5 rounded-xl bg-accent-green/6 border border-accent-green/20"
          >
            <p className="text-accent-green text-xs font-semibold mb-1">
              {isHe ? '💡 דוגמה — ניחוש 2-1:' : '💡 Example — predict 2-1:'}
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-white/70 text-xs">{isHe ? 'תוצאה' : 'Result'} ✓</span>
              <span className="text-white/30 text-xs">+3</span>
              <span className="text-white/30 text-xs">·</span>
              <span className="text-white/70 text-xs">{isHe ? 'סקור' : 'Score'} ✓</span>
              <span className="text-white/30 text-xs">+7</span>
              <span className="text-white/30 text-xs">=</span>
              <span className="text-accent-green font-bebas text-base">10 pts</span>
            </div>
          </motion.div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span>🔒</span>
              <span>{isHe ? 'ננעל 15 דק׳ לפני הקיקאוף' : 'Locks 15 min before kickoff'}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-white/30">{isHe ? 'מקס' : 'Max'}</span>
              <span className="font-bebas text-lg text-accent-green leading-none">19 pts</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
