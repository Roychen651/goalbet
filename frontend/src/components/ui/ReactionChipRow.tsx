import { motion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { DEBOSS_SHADOW } from '../../lib/tierVisuals';
import { cn } from '../../lib/utils';

interface ChipDef {
  id: string;
  en: string;
  he: string;
}

// The brief's own named set — "נתפס הפארליי!" ("Parlay busted!") is a
// deliberate cross-feature callback into Sprint 34's same-match parlays.
const CHIPS: ChipDef[] = [
  { id: 'fire', en: '🔥', he: '🔥' },
  { id: 'shock', en: '😮', he: '😮' },
  { id: 'quiet', en: '🤫', he: '🤫' },
  { id: 'no', en: '❌', he: '❌' },
  { id: 'goal', en: 'What a goal!', he: 'איזה גול!' },
  { id: 'parlay', en: 'Parlay busted!', he: 'נתפס הפארליי!' },
];

interface ReactionChipRowProps {
  onReact: (chip: string) => void;
}

/**
 * V5 Sprint 39 — "טראש טוק בלייב" (Live Trash Talk). An always-visible
 * inline row, not a tap-to-open drawer/sheet — a deliberate deviation
 * from the blueprint's literal "drawer" wording (see CLAUDE.md §53): a
 * feature whose entire value is speed shouldn't cost an extra tap to
 * reach 4-6 tiny chips. Reuses lib/tierVisuals.ts's DEBOSS_SHADOW so
 * these read as native GoalBet controls rather than a new visual
 * language. Tap feedback is this app's own established pairing
 * (haptic('selection') + playSound('toggle_click')) — no new synthesized
 * sound was warranted for a feature this small.
 */
export function ReactionChipRow({ onReact }: ReactionChipRowProps) {
  const { lang, t } = useLangStore();
  const isHe = lang === 'he';

  return (
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-display mb-1.5 px-0.5">
        {t('liveLobbyChipRowLabel')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((chip) => {
          const label = isHe ? chip.he : chip.en;
          return (
            <motion.button
              key={chip.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                haptic('selection');
                playSound('toggle_click');
                onReact(label);
              }}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/80 bg-white/5 border border-white/8 transition-colors active:text-white shrink-0',
                DEBOSS_SHADOW,
              )}
            >
              {label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
