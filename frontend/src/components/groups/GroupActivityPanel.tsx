// V7 — Locker Room widget consolidation (full-app audit, Sprint C). Prior
// to this, BattleMeter and SyndicatePoolCard each rendered as their own
// full-width GlassCard, stacked with independent mb-4 margins and
// independent entrance springs — three visually separate blocks (with
// MomentumBanner above them) for what a real audit pass flagged as "widget
// overload" on this page. User's own explicit answer: consolidate and
// collapse.
//
// This panel owns the SINGLE collapsed-vs-expanded decision for the pair:
// both children keep their full, untouched internal fetch/subscribe/RPC
// logic (bare/onHasContent are purely additive, presentation-only props —
// see each component's own header comment), and this panel only decides
// layout once BOTH have resolved whether they have real content:
//   - neither has content  -> one compact row (header + the same "Challenge
//     another group" CTA BattleMeter's own standalone idle state uses,
//     reused here via its `bare` mode so there's no duplicate idle UI)
//   - at least one has content -> render only the ones that do, grouped
//     under one shared "Group Activity" header instead of two separate
//     full-width cards with doubled vertical spacing.
//
// Returns null while either child hasn't resolved yet — the same
// "hidden/blank until real data exists" convention every other panel on
// this page (BattleMeter, SyndicatePoolCard, MomentumBanner) already
// follows standalone; this is that same convention applied one level up,
// not a new pattern.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { GlassCard } from '../ui/GlassCard';
import { BattleMeter } from './BattleMeter';
import { SyndicatePoolCard } from './SyndicatePoolCard';

export function GroupActivityPanel() {
  const { t, lang } = useLangStore();
  const isHe = lang === 'he';

  const [poolHasContent, setPoolHasContent] = useState<boolean | null>(null);
  const [battleHasContent, setBattleHasContent] = useState<boolean | null>(null);

  // Still waiting on at least one child's first fetch to resolve.
  if (poolHasContent === null || battleHasContent === null) {
    return (
      <div className="hidden">
        <BattleMeter bare onHasContent={setBattleHasContent} />
        <SyndicatePoolCard bare onHasContent={setPoolHasContent} />
      </div>
    );
  }

  const bothEmpty = !poolHasContent && !battleHasContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
      className="mb-4"
      dir={isHe ? 'rtl' : 'ltr'}
    >
      {bothEmpty ? (
        // Neither a pool nor a battle exists right now — the collapsed,
        // "something small" end state (never a wall of two empty-state
        // cards). Reuses BattleMeter's own idle CTA verbatim (non-bare) so
        // there's exactly one idle UI, not two drifting copies of it.
        <BattleMeter />
      ) : (
        <GlassCard variant="elevated" grain edgeGradient contentClassName="flex flex-col gap-3" className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-text-muted font-bebas">
            <Users size={12} />
            {t('groupActivityTitle')}
          </div>
          <div className="flex flex-col gap-3">
            {battleHasContent && <BattleMeter bare onHasContent={setBattleHasContent} />}
            {poolHasContent && <SyndicatePoolCard bare onHasContent={setPoolHasContent} />}
          </div>
        </GlassCard>
      )}
    </motion.div>
  );
}
