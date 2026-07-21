import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  X, Sparkles, Zap, Heart, Radar, Activity, BrainCircuit, Swords, Coins, Gem, Link,
  Flame, Radio, TrendingUp, Target, Fingerprint, CalendarDays, Trophy, Copy, Crosshair, Globe, Award,
} from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { EPOCH_ERAS, type EpochFeature } from '../../lib/whatsNewContent';

// V5 Sprint 38 — "The Epoch Showcase". A big scrollable informational sheet,
// structurally the same job as HelpGuideModal/CoinGuide (rule 4.13's
// swipe-to-close bottom-sheet ↔ centered-dialog shape) — but built with the
// backdrop/panel SEPARATION NotificationCenter's drawer (§38) established,
// not HelpGuideModal's card-elevated-on-a-draggable-panel combo.
//
// Why the different shell: this modal's panel carries `drag="y"` (a real,
// continuously-updated transform via Framer). `.card-elevated` carries its
// own `backdrop-filter`. Stacking backdrop-filter (or mix-blend-mode) on a
// transformed element is the exact documented WebKit paint-failure class
// this codebase has already shipped once (PredictionModal.tsx's Vaul
// sheet, §21/§34) — the fix there, and the one applied here from the
// start, is to put the blur ONLY on a separate, never-transformed sibling
// (the backdrop), and give the transformed panel a solid background
// instead. Backdrop and panel are two siblings, never nested.

interface Props {
  onClose: () => void;
}

const ICONS: Record<EpochFeature['icon'], typeof Sparkles> = {
  sparkles: Sparkles,
  zap: Zap,
  heart: Heart,
  radar: Radar,
  activity: Activity,
  'brain-circuit': BrainCircuit,
  swords: Swords,
  coins: Coins,
  gem: Gem,
  link: Link,
  flame: Flame,
  radio: Radio,
  'trending-up': TrendingUp,
  target: Target,
  fingerprint: Fingerprint,
  'calendar-days': CalendarDays,
  trophy: Trophy,
  copy: Copy,
  crosshair: Crosshair,
  globe: Globe,
  award: Award,
};

// V6 Sprint 48 — real per-feature ship dates, backfilled alongside the
// content itself. Locale-aware ('he-IL'/'en-US'), same branch already
// established for match kickoff times (lib/utils.ts's formatKickoffTime,
// Sprint 24) — never the browser-default locale, which would silently
// show English month names to Hebrew users.
function formatEpochDate(iso: string, isHe: boolean): string {
  return new Date(iso).toLocaleDateString(isHe ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const BACKDROP: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const SHEET: Variants = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } };

// staggerChildren parent — each FeatureCard is a child variant, revealed via
// whileInView (Framer's native scroll-trigger), not a hand-rolled
// IntersectionObserver.
const STAGGER_PARENT: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const FEATURE_ITEM: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

function FeatureCard({ feature, isHe, colorToken, reduce }: { feature: EpochFeature; isHe: boolean; colorToken: string; reduce: boolean }) {
  const Icon = ICONS[feature.icon];
  return (
    <motion.div
      variants={reduce ? undefined : FEATURE_ITEM}
      initial={reduce ? undefined : 'hidden'}
      whileInView={reduce ? undefined : 'visible'}
      viewport={{ once: true, amount: 0.3 }}
      className="flex items-start gap-3 py-3 border-b border-white/6 last:border-0"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: `color-mix(in oklch, var(${colorToken}) 16%, var(--color-bg-card))`,
          border: `1px solid color-mix(in oklch, var(${colorToken}) 35%, transparent)`,
          boxShadow: `0 0 18px color-mix(in oklch, var(${colorToken}) 25%, transparent)`,
        }}
      >
        <Icon size={18} style={{ color: `var(${colorToken})` }} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h4 className="text-white text-sm font-bold leading-snug">{isHe ? feature.titleHe : feature.title}</h4>
          <span className="text-white/30 text-[10px] font-mono tabular-nums shrink-0">
            {formatEpochDate(feature.date, isHe)}
          </span>
        </div>
        <p className="text-white/55 text-xs leading-relaxed mt-0.5">{isHe ? feature.descHe : feature.desc}</p>
      </div>
    </motion.div>
  );
}

export function WhatsNewModal({ onClose }: Props) {
  const { lang } = useLangStore();
  const isHe = lang === 'he';
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      variants={BACKDROP}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      {/* Backdrop — a separate, NEVER-transformed sibling. Blur lives here only. */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — carries the drag/entrance transform. Solid background, no
          blur/mix-blend of its own — see the header comment for why. */}
      <motion.div
        className="relative w-full sm:max-w-xl overflow-hidden z-10 max-h-[88dvh] sm:max-h-[80dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10"
        style={{ background: 'var(--color-tooltip-bg)' }}
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
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-text-muted/20" />
        </div>

        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-white/8 shrink-0 sticky top-0 z-10" style={{ background: 'var(--color-tooltip-bg)' }}>
          <div>
            <h2 className="font-bebas text-xl tracking-wider text-white">
              {isHe ? '✨ מה חדש ב-GoalBet' : '✨ The GoalBet Epoch'}
            </h2>
            <p className="text-text-muted text-xs mt-0.5">
              {isHe ? 'כל מה שבנינו, במקום אחד' : 'Everything we built, in one place'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/8 transition-all"
            aria-label={isHe ? 'סגור' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 py-2" onPointerDown={e => e.stopPropagation()}>
          {EPOCH_ERAS.map(era => (
            <section key={era.id} className="py-3">
              {/* Per-era sticky header */}
              <div
                className="sticky top-0 z-[5] -mx-5 px-5 py-2 mb-1 flex items-center gap-2"
                style={{ background: 'var(--color-tooltip-bg)' }}
              >
                <span className="text-xl leading-none">{era.emoji}</span>
                <div>
                  <h3 className="text-white text-base font-extrabold leading-tight" style={{ color: `var(${era.colorToken})` }}>
                    {isHe ? era.titleHe : era.title}
                  </h3>
                  <p className="text-white/40 text-[11px] leading-snug">{isHe ? era.subtitleHe : era.subtitle}</p>
                </div>
              </div>

              <motion.div
                variants={reduce ? undefined : STAGGER_PARENT}
                initial={reduce ? undefined : 'hidden'}
                whileInView={reduce ? undefined : 'visible'}
                viewport={{ once: true, amount: 0.1 }}
              >
                {era.features.map((f, i) => (
                  <FeatureCard key={i} feature={f} isHe={isHe} colorToken={era.colorToken} reduce={reduce} />
                ))}
              </motion.div>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-3 border-t border-white/8 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm bg-accent-green/15 border border-accent-green/30 text-accent-green hover:bg-accent-green/22 active:scale-[0.98] transition-all"
          >
            {isHe ? 'הבנתי, קדימה! 🚀' : "Got it, let's go! 🚀"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
