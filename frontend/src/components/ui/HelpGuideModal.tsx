import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Search, Users, Pencil, Layers, Wallet, Radio } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import { GlassCard } from './GlassCard';
import { POINTS, COIN_COSTS } from '../../lib/constants';
import { TIER_COLORS } from '../../lib/tierVisuals';

interface Props { onClose: () => void }

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-accent-green/12 border border-accent-green/25 flex items-center justify-center text-accent-green shrink-0">
        {icon}
      </div>
      <h3 className="text-white text-sm font-bold leading-none">{title}</h3>
    </div>
  );
}

function InfoRow({ icon, label, value, valueClass }: { icon: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-white/80 text-sm">{label}</span>
      </div>
      <span className={cn('text-sm font-bold font-mono tabular-nums', valueClass ?? 'text-accent-green')}>{value}</span>
    </div>
  );
}

// ─── Card A — The Game Loop ───────────────────────────────────────────────────
function GameLoopCard({ isHe }: { isHe: boolean }) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  const steps = isHe ? [
    { Icon: Users, title: 'הצטרפות', desc: 'צור קבוצה פרטית עם חברים או הצטרף עם קוד הזמנה בן 8 תווים.' },
    { Icon: Search, title: 'עיון', desc: 'משחקים מהליגות הפעילות שלך מופיעים בפיד. הוסף ליגות נוספות בהגדרות.' },
    { Icon: Pencil, title: 'ניבוי', desc: 'בחר את התחזיות שלך לפני נעילה — 15 דקות לפני הקיקאוף.' },
    { Icon: Trophy, title: 'ניקוד', desc: 'בסיום המשחק הנקודות מחושבות אוטומטית. הטבלה מתעדכנת בזמן אמת.' },
  ] : [
    { Icon: Users, title: 'Join', desc: 'Create a private group with friends or join one using an 8-character invite code.' },
    { Icon: Search, title: 'Browse', desc: 'Upcoming matches from your active leagues appear in the feed. Add more leagues in Settings.' },
    { Icon: Pencil, title: 'Predict', desc: 'Pick your tiers before the lock — predictions close 15 minutes before kickoff.' },
    { Icon: Trophy, title: 'Score', desc: 'After the final whistle, points are calculated automatically and the leaderboard updates live.' },
  ];

  return (
    <GlassCard variant="elevated" grain tactile className="p-4">
      <CardHeader icon={<Search size={14} />} title={isHe ? 'מעגל המשחק' : 'The Game Loop'} />

      {/* Connector row — 4 nodes joined by a single ambient CSS gradient sweep
          (.help-connector-line, index.css). Tap a node to reveal its detail
          below instead of always showing all 4 descriptions at once — a
          fixed bento cell has no room for the full text permanently. */}
      <div className="relative flex items-center justify-between px-1 mb-3">
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 help-connector-line rounded-full" />
        {steps.map((s, i) => {
          const isOpen = openStep === i;
          return (
            <button
              key={i}
              onClick={() => setOpenStep(isOpen ? null : i)}
              className="relative z-10 flex flex-col items-center gap-1.5 group"
              aria-expanded={isOpen}
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={cn(
                  'w-8 h-8 rounded-full border flex items-center justify-center transition-colors',
                  isOpen
                    ? 'bg-accent-green/20 border-accent-green/50 text-accent-green'
                    : 'bg-bg-card border-white/15 text-text-muted group-hover:text-white group-hover:border-white/30'
                )}
              >
                <s.Icon size={14} />
              </motion.div>
              <span className={cn('text-[9px] font-medium leading-none', isOpen ? 'text-accent-green' : 'text-text-muted')}>
                {s.title}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {openStep !== null && (
          <motion.p
            key={openStep}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
            className="text-text-muted text-xs leading-relaxed overflow-hidden"
          >
            {steps[openStep].desc}
          </motion.p>
        )}
      </AnimatePresence>
      {openStep === null && (
        <p className="text-text-muted text-[11px] leading-relaxed">
          {isHe ? 'הקש על שלב לפרטים' : 'Tap a step for details'}
        </p>
      )}
    </GlassCard>
  );
}

// ─── Card B — The Tier Ledger ─────────────────────────────────────────────────
// Canonical 5-tier order (Result / Score / Corners / BTTS / Over-Under) — a
// fixed reference ledger, unlike PredictionForm.tsx's own per-match tier
// list whose length (and therefore index) shifts when a league has corners
// disabled. Numbers come straight from POINTS/COIN_COSTS (constants.ts),
// never a second hardcoded copy — the same dual-source-of-truth trap this
// codebase self-corrects on repeatedly.
function TierLedgerCard({ isHe }: { isHe: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);

  const tiers = [
    { label: isHe ? 'תוצאה סופית' : 'Result', pts: POINTS.TIER1_OUTCOME, cost: COIN_COSTS.RESULT_ONLY },
    { label: isHe ? 'תוצאה מדויקת' : 'Exact Score', pts: POINTS.TIER2_EXACT_SCORE + POINTS.TIER2_EXACT_BONUS, cost: COIN_COSTS.SCORE },
    { label: isHe ? 'קרנות' : 'Corners', pts: POINTS.TIER3_CORNERS, cost: COIN_COSTS.CORNERS },
    { label: isHe ? 'שתי קבוצות מבקיעות' : 'BTTS', pts: POINTS.TIER5_BTTS, cost: COIN_COSTS.BTTS },
    { label: isHe ? 'מעל / מתחת 2.5' : 'Over / Under', pts: POINTS.TIER6_OVER_UNDER, cost: COIN_COSTS.OVER_UNDER },
  ];

  return (
    <GlassCard variant="elevated" grain tactile className="p-4">
      <CardHeader icon={<Layers size={14} />} title={isHe ? 'לוח השלבים' : 'The Tier Ledger'} />
      <div className="space-y-1">
        {tiers.map((tier, i) => {
          const color = TIER_COLORS[i];
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSelected ? null : i)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors text-start',
                isSelected ? 'bg-white/8 border-white/15' : 'bg-transparent border-transparent hover:bg-white/4'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
              <span className="flex-1 min-w-0 truncate text-white/85 text-xs">{tier.label}</span>
              <span className={cn('shrink-0 font-mono tabular-nums text-xs font-bold', color.pts)}>+{tier.pts}</span>
              <span className="shrink-0 font-mono tabular-nums text-[10px] text-amber-400/80 w-9 text-end">
                {tier.cost}🪙
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/8">
        <span className="text-text-muted text-[10px]">{isHe ? 'מקסימום למשחק' : 'Max per match'}</span>
        <span className="font-mono tabular-nums text-xs text-accent-green font-bold">{COIN_COSTS.MAX_PER_MATCH} {isHe ? 'נק׳' : 'pts'}</span>
      </div>
    </GlassCard>
  );
}

// ─── Card C — The Coin Economy ────────────────────────────────────────────────
// Deliberately does NOT repeat the per-tier cost table — that's Card B's
// job now (Correction: avoids showing the same 5 numbers twice across two
// cards). This card is scoped to flow only: how coins enter and leave the
// balance, not what a single bet costs.
function CoinEconomyCard({ isHe }: { isHe: boolean }) {
  return (
    <GlassCard variant="elevated" grain tactile className="p-4">
      <CardHeader icon={<Wallet size={14} />} title={isHe ? 'כלכלת המטבעות' : 'The Coin Economy'} />
      <div>
        <InfoRow icon="📅" label={isHe ? 'בונוס יומי' : 'Daily bonus'} value="+30 🪙" />
        <InfoRow icon="✅" label={isHe ? 'תביעת זכייה' : 'Winning claims'} value={isHe ? 'נק׳ × 2' : 'pts × 2'} />
        <InfoRow icon="⚡" label={isHe ? 'הימור מיידי' : 'Instant-lock bets'} value="-2 / +4 🪙" valueClass="text-white/70" />
      </div>
      <p className="text-text-muted text-[11px] leading-relaxed mt-2.5">
        {isHe
          ? 'יתרת המטבעות מוצגת תמיד כ-≥ 0 — אין מספרים שליליים.'
          : 'Your coin balance is always shown as ≥ 0 — no negatives ever.'}
      </p>
    </GlassCard>
  );
}

// ─── Card D — FAQ (Commit 2: ported, static list — accordion arrives in
// Commit 3) ─────────────────────────────────────────────────────────────────
function FaqCard({ isHe }: { isHe: boolean }) {
  const items = isHe ? [
    { icon: '🟢', title: 'עדכונים בזמן אמת', desc: 'משחקים חיים מתעדכנים כל 30 שניות.' },
    { icon: '⚽', title: 'הארכה ופנדלים', desc: 'ניבויים מתבססים על 90 הדקות בלבד.' },
    { icon: '⚔️', title: 'ראש בראש', desc: 'ניבויי חברים נסתרים עד לקיקאוף.' },
    { icon: '📐', title: 'קרנות', desc: 'מוזנות ידנית לאחר המשחק ונפתרות אוטומטית.' },
    { icon: '🔒', title: 'נעילה', desc: '15 דקות לפני הקיקאוף. ניתן לעדכן עד אז.' },
  ] : [
    { icon: '🟢', title: 'Live updates', desc: 'Live matches refresh every 30 seconds.' },
    { icon: '⚽', title: 'Extra time & pens', desc: 'Predictions always use the 90-minute score.' },
    { icon: '⚔️', title: 'Head to Head', desc: "Friends' predictions are hidden until kickoff." },
    { icon: '📐', title: 'Corners', desc: 'Entered manually post-match, resolved automatically.' },
    { icon: '🔒', title: 'Lock time', desc: '15 minutes before kickoff. Editable until then.' },
  ];

  return (
    <GlassCard variant="elevated" grain tactile className="p-4">
      <CardHeader icon={<Radio size={14} />} title={isHe ? 'שאלות נפוצות' : 'FAQ'} />
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 py-1">
            <span className="text-sm shrink-0 leading-none mt-0.5">{item.icon}</span>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium">{item.title}</p>
              <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const BACKDROP = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const SHEET = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } };

export function HelpGuideModal({ onClose }: Props) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      variants={BACKDROP}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-2xl card-elevated sm:rounded-2xl rounded-t-2xl overflow-hidden z-10 max-h-[90vh] sm:max-h-[85vh] flex flex-col"
        variants={SHEET}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 && info.velocity.y > 20) onClose();
        }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-text-muted/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-white/8 shrink-0">
          <div>
            <h2 className="font-bebas text-xl tracking-wider text-white">
              {isHe ? 'מדריך משתמש' : 'User Guide'}
            </h2>
            <p className="text-text-muted text-xs mt-0.5">
              {isHe ? 'כל מה שצריך לדעת על GoalBet' : 'Everything you need to know about GoalBet'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/8 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Bento grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 overflow-y-auto flex-1"
          onWheel={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <GameLoopCard isHe={isHe} />
          <TierLedgerCard isHe={isHe} />
          <CoinEconomyCard isHe={isHe} />
          <FaqCard isHe={isHe} />
        </div>
      </motion.div>
    </motion.div>
  );
}
