import { motion } from 'framer-motion';
import { CoinIcon } from './CoinIcon';
import { useLangStore } from '../../stores/langStore';

interface CoinGuideProps {
  onClose: () => void;
}

const EARN_ROWS = [
  {
    emoji: '🎁',
    label: 'Join Bonus',
    labelHe: 'בונוס הצטרפות',
    detail: 'Join or create any group — instant welcome gift',
    detailHe: 'בכל הצטרפות לקבוצה מקבלים מתנה ראשונית',
    value: '+120',
    color: 'from-emerald-500/15 to-emerald-600/8',
    border: 'border-emerald-500/25',
    textColor: 'text-emerald-400',
    pillBg: 'bg-emerald-400/10',
  },
  {
    emoji: '☀️',
    label: 'Daily Bonus',
    labelHe: 'בונוס יומי',
    detail: 'First app visit each day — credited automatically',
    detailHe: 'בכל יום, בכניסה הראשונה לאפליקציה, מועברים מטבעות לחשבונך',
    value: '+30 / day',
    valueHe: '+30 / יום',
    color: 'from-amber-500/15 to-amber-600/8',
    border: 'border-amber-500/25',
    textColor: 'text-amber-400',
    pillBg: 'bg-amber-400/10',
  },
  {
    emoji: '🏅',
    label: 'Win Reward',
    labelHe: 'פרס על ניחוש נכון',
    detail: 'Every point you earn pays back 2× in coins',
    detailHe: 'כל נקודה שמרוויחים מחזירה 2 מטבעות — כך מי שמנחש טוב מצבר יותר',
    value: '×2 per pt',
    valueHe: '×2 לנקודה',
    color: 'from-orange-500/15 to-orange-600/8',
    border: 'border-orange-500/25',
    textColor: 'text-orange-400',
    pillBg: 'bg-orange-400/10',
  },
];

// "Scoring" group — pick ONE of these (Result or Exact Score, not both)
const SCORING_TIERS = [
  {
    emoji: '🎯',
    label: 'Full Time Result only',
    labelHe: 'תוצאה סופית בלבד',
    note: 'H / Draw / A — no exact score',
    noteHe: 'ניצחון בית / תיקו / ניצחון חוץ — ללא תוצאה מדויקת',
    cost: 3,
    maxReturn: 6,
  },
  {
    emoji: '🎰',
    label: 'Exact Score',
    labelHe: 'תוצאה מדויקת',
    note: '+7 pts score, +3 pts result = 10 pts total',
    noteHe: '+7 נק׳ תוצאה מדויקת, +3 נק׳ תוצאה = 10 נק׳ סה״כ',
    cost: 10,
    maxReturn: 20,
  },
];

// "Add-on" group — these stack freely on top of whichever scoring tier is chosen
const ADDON_TIERS = [
  {
    emoji: '🚩',
    label: 'Corners',
    labelHe: 'קורנרים',
    cost: 4,
    maxReturn: 8,
  },
  {
    emoji: '⚽',
    label: 'Both Teams Score',
    labelHe: 'שתי הקבוצות מבקיעות',
    cost: 2,
    maxReturn: 4,
  },
  {
    emoji: '📊',
    label: 'Over / Under 2.5',
    labelHe: 'מעל / מתחת 2.5',
    cost: 3,
    maxReturn: 6,
  },
];

export function CoinGuide({ onClose }: CoinGuideProps) {
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Always-dark modal — same pattern as ScoringGuide */}
        <div className="bg-[#100c00] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden">

          {/* Ambient gold glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full"
              style={{ background: 'radial-gradient(ellipse, rgba(245,197,24,0.10) 0%, transparent 70%)', filter: 'blur(20px)' }}
            />
          </div>

          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* ── Header ── */}
          <div className="relative px-5 pt-3 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
                  >
                    <CoinIcon size={26} />
                  </motion.div>
                  <h2 className="font-bebas text-2xl tracking-wider text-white">
                    {isHe ? 'מערכת המטבעות' : 'Coins System'}
                  </h2>
                </div>
                <p className="text-white/45 text-xs">
                  {isHe ? 'מרוויחים, מהמרים, מנצחים' : 'Earn, bet, and grow your balance'}
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

          <div className="px-4 py-3 space-y-4 max-h-[65vh] overflow-y-auto">

            {/* ── Section: How You Earn ── */}
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest mb-2 px-1">
                {isHe ? 'איך מרוויחים מטבעות' : 'How you earn coins'}
              </p>
              <div className="space-y-1.5">
                {EARN_ROWS.map((row, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isHe ? 12 : -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 22 }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r ${row.color} border ${row.border}`}
                  >
                    <span className="text-lg shrink-0">{row.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold leading-tight">
                        {isHe ? row.labelHe : row.label}
                      </p>
                      <p className="text-white/45 text-xs mt-0.5 leading-snug">
                        {isHe ? row.detailHe : row.detail}
                      </p>
                    </div>
                    <div className={`shrink-0 ${row.pillBg} border ${row.border} rounded-lg px-2.5 py-1 text-end`}>
                      <span className={`font-bebas text-lg ${row.textColor} tabular-nums leading-none whitespace-nowrap`}>
                        {(isHe && row.valueHe) ? row.valueHe : row.value}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Section: Prediction Costs ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="space-y-3"
            >
              {/* Table header */}
              <div>
                <p className="text-white/35 text-[10px] uppercase tracking-widest mb-2 px-1">
                  {isHe ? 'עלות ניחוש לפי שלב' : 'Cost per prediction tier'}
                </p>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 pb-1.5 text-[10px] uppercase tracking-wider text-white/30">
                  <span>{isHe ? 'שלב' : 'Tier'}</span>
                  <span className="text-end">{isHe ? 'עלות' : 'Cost'}</span>
                  <span className="text-end">{isHe ? 'מקס׳ החזר' : 'Max return'}</span>
                </div>
              </div>

              {/* Scoring group — pick ONE */}
              <div>
                <p className="text-white/25 text-[9px] uppercase tracking-widest mb-1 px-1">
                  {isHe ? '— בחר אחד —' : '— pick one —'}
                </p>
                <div className="space-y-1">
                  {SCORING_TIERS.map((tier, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: isHe ? 8 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.28 + i * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
                      className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2 rounded-xl bg-white/4 border border-white/6"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{tier.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-white/75 text-xs font-medium leading-tight">
                            {isHe ? tier.labelHe : tier.label}
                          </p>
                          <p className="text-white/30 text-[10px] leading-tight">
                            {isHe ? tier.noteHe : tier.note}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <CoinIcon size={11} />
                        <span className="text-amber-400 font-bold text-xs tabular-nums">{tier.cost}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <CoinIcon size={11} />
                        <span className="text-emerald-400 font-bold text-xs tabular-nums">{tier.maxReturn}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Add-ons group — stack freely */}
              <div>
                <p className="text-white/25 text-[9px] uppercase tracking-widest mb-1 px-1">
                  {isHe ? '— תוספות (ניתן לשלב) —' : '— add-ons (stackable) —'}
                </p>
                <div className="space-y-1">
                  {ADDON_TIERS.map((tier, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: isHe ? 8 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.38 + i * 0.05, type: 'spring', stiffness: 200, damping: 22 }}
                      className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-3 py-2 rounded-xl bg-white/4 border border-white/6"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{tier.emoji}</span>
                        <p className="text-white/75 text-xs font-medium truncate">
                          {isHe ? tier.labelHe : tier.label}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <CoinIcon size={11} />
                        <span className="text-amber-400 font-bold text-xs tabular-nums">{tier.cost}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <CoinIcon size={11} />
                        <span className="text-emerald-400 font-bold text-xs tabular-nums">{tier.maxReturn}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* ── Example ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20"
            >
              <p className="text-amber-400 text-xs font-semibold mb-1.5">
                {isHe ? '💡 דוגמה — ניחשת 2-1 ונכון בהכל:' : '💡 Example — predicted 2-1, everything correct:'}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-white/60 text-xs">{isHe ? 'כל השלבים' : 'All tiers'}</span>
                <span className="text-white/30 text-xs">→</span>
                <span className="text-white/60 text-xs">19 {isHe ? 'נק׳' : 'pts'}</span>
                <span className="text-white/30 text-xs">→</span>
                <span className="flex items-center gap-1">
                  <CoinIcon size={13} />
                  <span className="font-bebas text-xl text-amber-400 leading-none">38</span>
                  <span className="text-white/40 text-xs">{isHe ? 'מטבעות' : 'coins'}</span>
                </span>
              </div>
            </motion.div>

          </div>

          {/* ── Footer ── */}
          <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span>⚠️</span>
              <span>
                {isHe
                  ? 'ניחוש שהפסיד — המטבעות לא חוזרים'
                  : 'Lost bets are not refunded — choose wisely'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs shrink-0">
              <span className="text-white/30">{isHe ? 'מקס׳' : 'Max'}</span>
              <CoinIcon size={13} />
              <span className="font-bebas text-lg text-amber-400 leading-none">19</span>
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
