// Container-level Progressive Disclosure — extracted out of SettingsPage.tsx
// (V7, originally built for its Admin Tools "Danger Zone" card) the moment
// Profile page's own widget-overload consolidation (full-app audit, Sprint
// C) needed the identical collapse mechanism as a second real consumer —
// the same "extract on the second real consumer" precedent already applied
// to lib/espnEvents.ts/lib/teamNameUtils.ts/lib/tierVisuals.ts elsewhere in
// this codebase. SettingsPage.tsx now imports from here; its own behavior
// is byte-for-byte unchanged.
//
// A container-level counterpart to this app's many ACTION-level disclosures
// (Reset Scores/Delete Group's own AnimatePresence height reveals, Change
// Password's reveal-on-tap). Those disclose at the action level; this
// discloses at the SECTION level — the whole card starts collapsed, so a
// rarely-needed group of content (SettingsPage's "Danger Zone"; Profile's
// deep stats) doesn't cost every visit permanent screen real estate.
//
// Reuses the exact AnimatePresence height:0->auto shape already proven
// jank-free throughout this codebase — no new animation primitive. The
// chevron rotates open/closed rather than swapping icons or mirroring by
// language — an expand indicator's job is "reveals downward," a
// direction-agnostic rotation, not a "points forward in reading direction"
// navigational icon (the literal RTL-icon-mirroring rule doesn't apply to
// this specific job — confirmed via a real Hebrew render when this
// component first shipped).

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../../lib/utils';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';

export function DisclosureSection({
  icon: Icon,
  title,
  hint,
  accent = 'green',
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  accent?: 'green' | 'orange';
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOrange = accent === 'orange';

  return (
    <GlassCard className={cn('p-4', isOrange && 'border-accent-orange/15')}>
      <button
        onClick={() => {
          haptic('selection');
          playSound('toggle_click');
          setOpen(o => !o);
        }}
        className="w-full flex items-center justify-between gap-3"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-8 h-8 rounded-xl border flex items-center justify-center shrink-0',
            isOrange ? 'bg-accent-orange/10 border-accent-orange/20' : 'bg-accent-green/10 border-accent-green/20',
          )}>
            <Icon size={15} className={isOrange ? 'text-accent-orange' : 'text-accent-green'} />
          </div>
          <div className="text-start min-w-0">
            <p className="text-text-primary text-sm font-medium">{title}</p>
            {hint && !open && <p className="text-text-muted text-xs mt-0.5 truncate">{hint}</p>}
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="shrink-0"
        >
          <ChevronRight size={16} className="text-text-muted" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn('pt-4 mt-4 border-t space-y-4', isOrange ? 'border-accent-orange/15' : 'border-white/8')}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
