import { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { X, Trophy, Search, Users, Pencil, Layers, Wallet, Radio, ChevronDown } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';
import { GlassCard } from './GlassCard';
import { CoinIcon } from './CoinIcon';
import { POINTS, COIN_COSTS } from '../../lib/constants';
import { TIER_COLORS } from '../../lib/tierVisuals';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

// Sprint 25 Commit 4 — every new tappable surface in this modal gets the
// same haptic('selection') + playSound('toggle_click') pairing already
// established for GenderSelector's chips (Sprint 24) — a genuinely new
// interactive surface should get the same tactile treatment every other
// tappable control in this app already has, not silence.
function tapFeedback(): void {
  haptic('selection');
  playSound('toggle_click');
}

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

function InfoRow({ icon, label, value, valueClass }: { icon: string; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-white/80 text-sm">{label}</span>
      </div>
      <span className={cn('flex items-center gap-1 text-sm font-bold font-mono tabular-nums', valueClass ?? 'text-accent-green')}>{value}</span>
    </div>
  );
}

// ─── Card A — The Game Loop ───────────────────────────────────────────────────
function GameLoopCard({ isHe }: { isHe: boolean }) {
  // Sprint 25 hotfix — a card that opens with "tap a step for details" and
  // nothing else read as empty/uninformative (real user report: "not
  // informative", "wanted the ultimate guide"). Opens on step 0 by default
  // so there's always real content on screen at rest, not just an
  // instruction to go find it.
  const [openStep, setOpenStep] = useState<number | null>(0);

  const steps = isHe ? [
    { Icon: Users, title: 'הצטרפות', desc: 'צור קבוצה פרטית עם חברים או הצטרף עם קוד הזמנה בן 8 תווים.' },
    { Icon: Search, title: 'עיון', desc: 'משחקים מהליגות הפעילות שלך מופיעים בפיד. הוסף ליגות נוספות בהגדרות.' },
    { Icon: Pencil, title: 'ניחוש', desc: 'בחר את הניחושים שלך לפני נעילה — 15 דקות לפני הקיקאוף.' },
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
              onClick={() => { tapFeedback(); setOpenStep(isOpen ? null : i); }}
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
        {openStep !== null ? (
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
        ) : (
          <p className="text-text-muted text-[11px] leading-relaxed">
            {isHe ? 'הקש על שלב לפרטים' : 'Tap a step for details'}
          </p>
        )}
      </AnimatePresence>

      <div className="mt-3 p-2.5 rounded-lg bg-accent-green/6 border border-accent-green/15">
        <p className="text-accent-green text-[10px] font-medium mb-0.5">💡 {isHe ? 'טיפ' : 'Tip'}</p>
        <p className="text-white/70 text-[11px] leading-relaxed">
          {isHe
            ? 'ניתן לעדכן ניחוש בכל עת כל עוד המשחק לא ננעל — רק העדכון האחרון נספר.'
            : "You can update a prediction any time before it locks — only your last save counts."}
        </p>
      </div>
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
    { label: isHe ? 'שתי הקבוצות מבקיעות' : 'BTTS', pts: POINTS.TIER5_BTTS, cost: COIN_COSTS.BTTS },
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
              onClick={() => { tapFeedback(); setSelected(isSelected ? null : i); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors text-start',
                isSelected ? 'bg-white/8 border-white/15' : 'bg-transparent border-transparent hover:bg-white/4'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
              <span className="flex-1 min-w-0 truncate text-white/85 text-xs">{tier.label}</span>
              <span className={cn('shrink-0 font-mono tabular-nums text-xs font-bold', color.pts)}>+{tier.pts}</span>
              <span className="shrink-0 flex items-center gap-0.5 font-mono tabular-nums text-[10px] text-amber-400/80 w-10 justify-end">
                {tier.cost}<CoinIcon size={11} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/8">
        <span className="text-text-muted text-[10px]">{isHe ? 'מקסימום למשחק' : 'Max per match'}</span>
        <span className="font-mono tabular-nums text-xs text-accent-green font-bold">{COIN_COSTS.MAX_PER_MATCH} {isHe ? 'נק׳' : 'pts'}</span>
      </div>
      <p className="text-text-muted text-[11px] leading-relaxed mt-2.5 pt-2.5 border-t border-white/8">
        {isHe
          ? 'ניחוש מדויק של הסקור מעניק אוטומטית גם את נקודות התוצאה הסופית — לכן "תוצאה מדויקת" שווה 10 נק׳ כולל (7 + 3 בונוס). קרנות אינן זמינות במשחקי ידידות בינלאומיים.'
          : 'Getting the exact score right automatically awards the Result tier too — that\'s why "Exact Score" is worth 10 pts total (7 + 3 bonus). Corners is unavailable for International Friendlies.'}
      </p>
    </GlassCard>
  );
}

// ─── Card C — The Coin Economy ────────────────────────────────────────────────
// Deliberately does NOT repeat the per-tier cost table — that's Card B's
// job now (Correction: avoids showing the same 5 numbers twice across two
// cards). This card is scoped to flow only: how coins enter and leave the
// balance, not what a single bet costs.
// Three ambient coin particles drift behind the header — purely
// decorative, pointer-events-none, disabled under prefers-reduced-motion
// (.coin-drift-particle, index.css). Staggered animation-delay so they
// don't move in lockstep.
//
// Sprint 25 hotfix — this band was originally `inset-0` (spanning the
// whole card) with each particle positioned at `top: 50%` of the card's
// total height. That was fine when the card was short, but restoring the
// "How it works" worked-example paragraph (below, this same hotfix) made
// the card tall enough that the 50% midpoint now lands squarely on the
// "Instant-lock bets" row — a real, reported legibility problem, not a
// hypothetical one. Confined to a fixed-height band behind the header
// only, so it can never collide with a content row no matter how long the
// card grows.
const COIN_DRIFT_POSITIONS = [
  { insetInlineStart: '8%', animationDelay: '0s' },
  { insetInlineStart: '45%', animationDelay: '1.6s' },
  { insetInlineStart: '80%', animationDelay: '3.2s' },
];

function CoinEconomyCard({ isHe }: { isHe: boolean }) {
  return (
    <GlassCard variant="elevated" grain tactile className="p-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-14 pointer-events-none" aria-hidden="true">
        {COIN_DRIFT_POSITIONS.map((pos, i) => (
          <div key={i} className="absolute top-1/2 coin-drift-particle" style={pos as React.CSSProperties}>
            <CoinIcon size={14} />
          </div>
        ))}
      </div>
      <div className="relative z-10">
        <CardHeader icon={<Wallet size={14} />} title={isHe ? 'כלכלת המטבעות' : 'The Coin Economy'} />
        <div>
          <InfoRow icon="📅" label={isHe ? 'בונוס יומי' : 'Daily bonus'} value={<>+30<CoinIcon size={11} /></>} />
          <InfoRow icon="✅" label={isHe ? 'זכייה בניחוש' : 'Winning claims'} value={isHe ? 'נק׳ × 2' : 'pts × 2'} />
          <InfoRow icon="⚡" label={isHe ? 'הימור מיידי' : 'Instant-lock bets'} value={<>-2 / +4<CoinIcon size={11} /></>} valueClass="text-white/70" />
        </div>
        <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
          <p className="text-amber-400 text-[10px] font-medium mb-0.5">💡 {isHe ? 'איך זה עובד' : 'How it works'}</p>
          <p className="text-white/70 text-[11px] leading-relaxed">
            {isHe
              ? 'ניחשת את כל 5 השלבים — הימרת 19 מטבעות. קלעת בכולם — קיבלת 38 מטבעות בחזרה (× 2). היתרה תמיד ≥ 0, אין מספרים שליליים.'
              : 'Bet all 5 tiers → stake 19 coins. Hit them all → earn 38 coins back (19 pts × 2). Balance is always ≥ 0 — no negatives ever.'}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Card D — FAQ Accordion (Sprint 25 Commit 3) ──────────────────────────────
// One-open-at-a-time, matching WorldCupBracket.tsx's existing single-round
// accordion convention rather than inventing a new multi-expand model this
// codebase has no precedent for. The height:0/height:'auto' AnimatePresence
// shape is copied verbatim from that same component — CLAUDE.md's own
// Common Pitfalls cite it by name as the reference for "do not convert to
// CSS transitions, Framer handles the auto-height measurement."
function FaqCard({ isHe }: { isHe: boolean }) {
  const [openId, setOpenId] = useState<number | null>(null);

  const items = isHe ? [
    { icon: '🟢', title: 'עדכונים בזמן אמת', desc: 'משחקים חיים מתעדכנים כל 30 שניות ישירות מ-ESPN.' },
    { icon: '⚽', title: 'הארכה ופנדלים', desc: 'ניחושים תמיד מתבססים על תוצאת 90 הדקות בלבד. שערים בהארכה ובפנדלים לא נספרים לניקוד.' },
    { icon: '⚔️', title: 'ראש בראש', desc: 'ניחושי חברים בקבוצה נסתרים עד לקיקאוף. לאחר מכן, לחץ על שורה בטבלה לצפייה בהשוואה מלאה.' },
    { icon: '📐', title: 'קרנות', desc: 'מספר הקרנות מוזן ידנית לאחר סיום המשחק. ברגע שהוזן, ניחושי הקרנות נפתרים אוטומטית.' },
    { icon: '🔒', title: 'זמן נעילה', desc: 'ניחושים ננעלים 15 דקות לפני הקיקאוף. ניתן לעדכן את הניחוש בכל עת עד לנעילה — רק העדכון האחרון נספר.' },
    { icon: '✏️', title: 'עריכת ניחוש', desc: 'כן — אפשר לשנות כל שלב שכבר בחרת כל עוד המשחק לא ננעל, ללא הגבלת מספר פעמים.' },
    { icon: '🏆', title: 'מקסימום נקודות', desc: '19 נקודות למשחק בודד — כל 5 השלבים במלואם, כולל בונוס התוצאה המדויקת.' },
    { icon: '👥', title: 'קופה משותפת', desc: 'בקצה מסך הניחוש תוכלו לפתוח קופה משותפת עם הניחוש שבחרתם. כל חבר קבוצה יכול לתרום מטבעות — אם הניחוש יוצא נכון, הזכייה מתחלקת בין כל התורמים לפי אחוז התרומה שלהם.' },
    { icon: '⚔️', title: 'קרב קבוצות', desc: 'בהגדרות אפשר לאתגר קבוצה יריבה עם קוד ההזמנה שלה, לתקופה של סוף שבוע או שבוע. הניצחון נקבע לפי ממוצע 5 הניחושים הכי טובים של כל קבוצה באותה תקופה.' },
  ] : [
    { icon: '🟢', title: 'Live updates', desc: 'Live matches refresh every 30 seconds, pulled directly from ESPN.' },
    { icon: '⚽', title: 'Extra time & penalties', desc: 'Predictions always use the 90-minute score only. Goals in extra time and penalty shootouts never count toward points.' },
    { icon: '⚔️', title: 'Head to Head', desc: "Friends' predictions are hidden until kickoff. After that, tap any leaderboard row for a full side-by-side comparison." },
    { icon: '📐', title: 'Corners', desc: 'Corner totals are entered manually after each match. The moment they land, corners predictions resolve automatically.' },
    { icon: '🔒', title: 'Lock time', desc: 'Predictions lock 15 minutes before kickoff. You can update your pick any number of times before then — only the last save counts.' },
    { icon: '✏️', title: 'Can I edit a prediction?', desc: "Yes — change any tier you've already picked as many times as you like, right up until the lock." },
    { icon: '🏆', title: 'Maximum points', desc: '19 points on a single match — all 5 tiers correct, including the exact-score stacking bonus.' },
    { icon: '👥', title: 'Shared Pools', desc: 'From the prediction sheet, start a Shared Pool with your picked tiers. Any group member can contribute coins — if the pick is fully correct, the winnings split among all contributors by their share of the total stake.' },
    { icon: '⚔️', title: 'Group Battles', desc: "From Settings, challenge a rival group using their invite code, over a weekend or a full week. The winner is whichever group's top 5 point-scoring predictions in that window average higher." },
  ];

  return (
    <GlassCard variant="elevated" grain tactile className="p-4 sm:flex sm:flex-col sm:max-h-[320px]">
      <CardHeader icon={<Radio size={14} />} title={isHe ? 'שאלות נפוצות' : 'FAQ'} />
      {/* Sprint 25 — Correction: an expanding accordion inside a fixed bento
          cell must not grow the whole grid row (it would drag Card C's
          height along with it via CSS Grid's default row-stretch). This
          list gets its own bounded, internally scrolling region on sm+
          instead — Card D's outer card height never changes. On mobile the
          whole sheet already scrolls, so no extra constraint is needed
          there. */}
      <LayoutGroup id="help-faq">
        <div className="space-y-1 sm:overflow-y-auto sm:flex-1 sm:pe-1 sm:min-h-0" data-lenis-prevent>
          {items.map((item, i) => {
            const isOpen = openId === i;
            return (
              <motion.div key={i} layout className="rounded-lg overflow-hidden">
                <button
                  onClick={() => { tapFeedback(); setOpenId(isOpen ? null : i); }}
                  className="w-full flex items-center gap-2 py-1.5 text-start"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm shrink-0 leading-none">{item.icon}</span>
                  <span className="flex-1 min-w-0 text-white text-xs font-medium truncate">{item.title}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' as const }}
                    className="shrink-0 text-text-muted"
                  >
                    <ChevronDown size={13} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' as const }}
                      className="overflow-hidden min-h-0"
                      style={{ willChange: 'height' }}
                    >
                      <p className="text-text-muted text-[11px] leading-relaxed ps-6 pb-2 pe-1">
                        {item.desc}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
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
        className="relative w-full sm:max-w-2xl card-elevated sm:rounded-2xl rounded-t-2xl overflow-hidden z-10 max-h-[90dvh] sm:max-h-[82dvh] flex flex-col"
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

        {/* Bento grid. Sprint 25 hotfix — real device report: the FAQ card's
            last row sat flush against the home-indicator area with zero
            breathing room ("cut off"). env(safe-area-inset-bottom) is the
            same fix NotificationCenter's mobile drawer already applies
            (§38) for the identical reason; falls back to 0px on devices/
            browsers without a safe-area inset. */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 auto-rows-min content-start gap-3 p-4 overflow-y-auto flex-1 min-h-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
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
