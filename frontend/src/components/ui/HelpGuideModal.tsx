import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Pencil, Radio, Wallet, type LucideIcon } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { cn } from '../../lib/utils';

type Tab = 'play' | 'bets' | 'live' | 'coins';

interface Props { onClose: () => void }

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/50 text-[10px] uppercase tracking-widest font-medium mb-3">
      {children}
    </p>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-accent-green/15 border border-accent-green/30 flex items-center justify-center">
        <span className="text-accent-green text-xs font-bold">{n}</span>
      </div>
      <div>
        <p className="text-white text-sm font-medium leading-snug">{title}</p>
        <p className="text-text-muted text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function TierRow({ tier, label, pts, note }: { tier: number; label: string; pts: number; note?: string }) {
  const colors = ['', 'text-blue-400', 'text-purple-400', 'text-amber-400', 'text-pink-400', 'text-cyan-400'];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className={cn('shrink-0 w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center text-xs font-bold', colors[tier])}>
        {tier}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm leading-snug">{label}</p>
        {note && <p className="text-text-muted text-[11px] mt-0.5">{note}</p>}
      </div>
      <div className="shrink-0 font-bebas text-base text-accent-green">+{pts}</div>
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
      <span className={cn('text-sm font-bold font-bebas', valueClass ?? 'text-accent-green')}>{value}</span>
    </div>
  );
}

// ─── Tab: How to Play ─────────────────────────────────────────────────────────
function PlayTab({ isHe }: { isHe: boolean }) {
  const steps = isHe ? [
    { title: 'הצטרף לקבוצה', desc: 'צור קבוצה פרטית עם חברים או הצטרף עם קוד הזמנה בן 8 תווים.' },
    { title: 'עיין במשחקים', desc: 'משחקים מהליגות הפעילות שלך מופיעים בפיד. הוסף ליגות נוספות בהגדרות.' },
    { title: 'בצע ניבויים', desc: 'בחר את התחזיות שלך לפני נעילה — 15 דקות לפני הקיקאוף.' },
    { title: 'אסוף נקודות', desc: 'בסיום המשחק הנקודות מחושבות אוטומטית. הטבלה מתעדכנת בזמן אמת.' },
  ] : [
    { title: 'Join a group', desc: 'Create a private group with friends or join one using an 8-character invite code.' },
    { title: 'Browse matches', desc: 'Upcoming matches from your active leagues appear in the feed. Add more leagues in Settings.' },
    { title: 'Make predictions', desc: 'Pick your tiers before the lock — predictions close 15 minutes before kickoff.' },
    { title: 'Collect points', desc: 'After the final whistle, points are calculated automatically and the leaderboard updates live.' },
  ];

  return (
    <div>
      <SectionTitle>{isHe ? 'איך מתחילים' : 'Getting started'}</SectionTitle>
      {steps.map((s, i) => <Step key={i} n={i + 1} title={s.title} desc={s.desc} />)}
      <div className="mt-4 p-3 rounded-xl bg-accent-green/6 border border-accent-green/15">
        <p className="text-accent-green text-xs font-medium mb-1">💡 {isHe ? 'טיפ' : 'Tip'}</p>
        <p className="text-white/70 text-xs leading-relaxed">
          {isHe
            ? 'ניתן לעדכן ניבויים כל עוד המשחק לא ננעל. רק הניבוי האחרון שנשמר נספר.'
            : 'You can update your prediction at any time while it\'s unlocked — only your last saved pick counts.'}
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Predictions / Bets ──────────────────────────────────────────────────
function BetsTab({ isHe }: { isHe: boolean }) {
  const tiers = isHe ? [
    { tier: 1, label: 'תוצאה סופית (בית / תיקו / חוץ)', pts: 3 },
    { tier: 2, label: 'תוצאה מדויקת', pts: 10, note: 'כולל תוצאה סופית — 7 + 3 נק׳' },
    { tier: 3, label: 'סה"כ קרנות (≤9 / 10 בדיוק / ≥11)', pts: 4 },
    { tier: 4, label: 'שתי הקבוצות מבקיעות (כן / לא)', pts: 2 },
    { tier: 5, label: 'מעל / מתחת 2.5 שערים', pts: 3 },
  ] : [
    { tier: 1, label: 'Full Time Result (Home / Draw / Away)', pts: 3 },
    { tier: 2, label: 'Exact Score', pts: 10, note: 'includes the result — 7 + 3 pts stacked' },
    { tier: 3, label: 'Total Corners (≤9 / exactly 10 / ≥11)', pts: 4 },
    { tier: 4, label: 'Both Teams to Score (Yes / No)', pts: 2 },
    { tier: 5, label: 'Over / Under 2.5 Goals', pts: 3 },
  ];

  return (
    <div>
      <SectionTitle>{isHe ? 'ניקוד לפי שלב' : 'Points per tier'}</SectionTitle>
      <div className="rounded-xl bg-white/4 border border-white/8 px-3 overflow-hidden mb-4">
        {tiers.map(t => <TierRow key={t.tier} {...t} />)}
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-accent-green/8 border border-accent-green/20 mb-5">
        <span className="text-white/70 text-xs">{isHe ? 'מקסימום למשחק' : 'Maximum per match'}</span>
        <span className="font-bebas text-lg text-accent-green">19 {isHe ? 'נק׳' : 'pts'}</span>
      </div>

      <SectionTitle>{isHe ? 'שלב 2 — תוצאה מדויקת' : 'Tier 2 — Exact Score'}</SectionTitle>
      <p className="text-white/60 text-xs leading-relaxed">
        {isHe
          ? 'ניחוש מדויק של הסקור מעניק אוטומטית גם את נקודות התוצאה הסופית. לכן שלב 2 שווה 10 נק׳ כולל (7 + 3).'
          : 'Getting the exact score right automatically awards Tier 1 (the result is implied). That\'s why Tier 2 is worth 10 pts total (7 + 3 stacked).'}
      </p>
    </div>
  );
}

// ─── Tab: Live & Results ──────────────────────────────────────────────────────
function LiveTab({ isHe }: { isHe: boolean }) {
  const items = isHe ? [
    { icon: '🟢', title: 'עדכונים בזמן אמת', desc: 'משחקים חיים מוצגים עם נקודה ירוקה מהבהבת. תוצאות מתעדכנות כל 30 שניות.' },
    { icon: '✅', title: 'פירוט נקודות', desc: 'לאחר סיום המשחק (FT) מוצג פירוט מלא — אילו שלבים פגעת ואת הנקודות שהרווחת.' },
    { icon: '📐', title: 'קרנות', desc: 'מספר הקרנות מוזן ידנית לאחר המשחק. לאחר עדכון, ניבויי הקרנות נפתרים אוטומטית.' },
    { icon: '⚽', title: 'הארכה ופנדלים', desc: 'ניבויים מתבססים על תוצאת 90 הדקות. שערים בהארכה ופנדלים לא נספרים.' },
    { icon: '⚔️', title: 'ראש בראש', desc: 'ניבויי חברים נסתרים עד לקיקאוף. לאחר מכן, לחץ על שורה בטבלה לצפייה בהשוואה.' },
  ] : [
    { icon: '🟢', title: 'Real-time updates', desc: 'Live matches show a pulsing green dot. Scores refresh every 30 seconds from ESPN.' },
    { icon: '✅', title: 'Points breakdown', desc: 'After full time (FT), a breakdown shows exactly which tiers hit and the points you earned.' },
    { icon: '📐', title: 'Corners', desc: 'Corner totals are entered manually after each match. Corners predictions then resolve automatically on the next sync.' },
    { icon: '⚽', title: 'Extra time & penalties', desc: 'Predictions always use the 90-minute score. Goals in extra time and penalty shootouts do not count.' },
    { icon: '⚔️', title: 'Head to Head', desc: 'Friends\' predictions are hidden until kickoff. After that, tap any leaderboard row for a side-by-side comparison.' },
  ];

  return (
    <div className="space-y-2.5">
      <SectionTitle>{isHe ? 'מהלך המשחק' : 'Match lifecycle'}</SectionTitle>
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
          <span className="text-xl shrink-0 leading-none mt-0.5">{item.icon}</span>
          <div>
            <p className="text-white text-sm font-medium">{item.title}</p>
            <p className="text-text-muted text-xs mt-0.5 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Coin Economy ────────────────────────────────────────────────────────
function CoinsTab({ isHe }: { isHe: boolean }) {
  return (
    <div>
      <SectionTitle>{isHe ? 'הכנסות' : 'Earning coins'}</SectionTitle>
      <div className="rounded-xl bg-white/4 border border-white/8 px-3 mb-5">
        <InfoRow icon="🎁" label={isHe ? 'בונוס הצטרפות (חד-פעמי)' : 'Join bonus (one-time)'} value="+120 🪙" />
        <InfoRow icon="📅" label={isHe ? 'בונוס יומי' : 'Daily login bonus'} value="+30 🪙" />
        <InfoRow icon="⚽" label={isHe ? 'על כל שלב שפגעת' : 'Per correct tier'} value={isHe ? 'נקודות × 2' : 'pts × 2'} />
      </div>

      <SectionTitle>{isHe ? 'עלות ניבוי לפי שלב' : 'Cost to predict per tier'}</SectionTitle>
      <div className="rounded-xl bg-white/4 border border-white/8 px-3 mb-5">
        <InfoRow icon="1️⃣" label={isHe ? 'תוצאה סופית' : 'Full Time Result'} value="3 🪙" valueClass="text-white/70" />
        <InfoRow icon="2️⃣" label={isHe ? 'תוצאה מדויקת' : 'Exact Score'} value="10 🪙" valueClass="text-white/70" />
        <InfoRow icon="3️⃣" label={isHe ? 'קרנות' : 'Total Corners'} value="4 🪙" valueClass="text-white/70" />
        <InfoRow icon="4️⃣" label={isHe ? 'שתי קבוצות מבקיעות' : 'BTTS'} value="2 🪙" valueClass="text-white/70" />
        <InfoRow icon="5️⃣" label={isHe ? 'מעל / מתחת 2.5' : 'Over / Under 2.5'} value="3 🪙" valueClass="text-white/70" />
      </div>

      <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
        <p className="text-amber-400 text-xs font-medium mb-1.5">💡 {isHe ? 'איך זה עובד' : 'How it works'}</p>
        <p className="text-white/70 text-xs leading-relaxed">
          {isHe
            ? 'ניבאת את כל 5 השלבים — הימרת 19 מטבעות. קיבלת 19 נק׳ מלאות — מקבל 38 מטבעות חזרה (× 2). יתרת המטבעות מוצגת תמיד כ-≥ 0.'
            : 'Bet all 5 tiers → stake 19 coins. Hit them all → earn 38 coins back (19 pts × 2). Your coin balance is always shown as ≥ 0 — no negatives ever.'}
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const BACKDROP = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const SHEET = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } };

export function HelpGuideModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const { lang } = useLangStore();
  const isHe = lang === 'he';

  const tabs: { id: Tab; Icon: LucideIcon; en: string; he: string }[] = [
    { id: 'play', Icon: Trophy, en: 'How to Play', he: 'איך משחקים' },
    { id: 'bets', Icon: Pencil, en: 'Predictions', he: 'ניבויים' },
    { id: 'live', Icon: Radio, en: 'Results', he: 'תוצאות' },
    { id: 'coins', Icon: Wallet, en: 'Coins', he: 'מטבעות' },
  ];

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
        className="relative w-full sm:max-w-md card-elevated sm:rounded-2xl rounded-t-2xl overflow-hidden z-10 max-h-[90vh] sm:max-h-[85vh] flex flex-col"
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

        {/* Tab strip */}
        <div className="flex px-3 pt-3 gap-1 shrink-0">
          {tabs.map(({ id, Icon, en, he }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[10px] font-medium transition-all',
                activeTab === id
                  ? 'bg-accent-green/12 text-accent-green'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              <span className="leading-none">{isHe ? he : en}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="overflow-y-auto flex-1 px-5 py-4"
            onWheel={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            {activeTab === 'play' && <PlayTab isHe={isHe} />}
            {activeTab === 'bets' && <BetsTab isHe={isHe} />}
            {activeTab === 'live' && <LiveTab isHe={isHe} />}
            {activeTab === 'coins' && <CoinsTab isHe={isHe} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
