import { motion } from 'framer-motion';
import { useLangStore } from '../stores/langStore';
import { ActivityFeed } from '../components/groups/ActivityFeed';
import { MomentumBanner } from '../components/groups/MomentumBanner';
import { SyndicatePoolCard } from '../components/groups/SyndicatePoolCard';
import { BattleMeter } from '../components/groups/BattleMeter';
import { VoiceRadioPlayer } from '../components/groups/VoiceRadioPlayer';
import { useGroupEvents } from '../hooks/useGroupEvents';

export function LockerRoomPage() {
  const { t } = useLangStore();
  // V7 Sprint 51 — a second, independent useGroupEvents() call (ActivityFeed
  // below owns its own instance too). Safe by design: the underlying
  // Realtime binding is a Map<table, Set<handler>> registry (RealtimeProvider,
  // Sprint 35) that natively supports multiple simultaneous listeners on the
  // same table — the exact mechanism that let NotificationCenter's old
  // per-instance channel-name-suffix workaround be deleted outright once
  // this registry shipped. events is already sorted created_at DESC, so the
  // first COMMISSIONER_BRIEF hit is always the most recent week's brief —
  // the "now playing" slot, distinct from ActivityFeed's own historical
  // COMMISSIONER_BRIEF timeline cards (every past week's entry).
  const { events } = useGroupEvents();
  const latestBrief = events.find((e) => e.event_type === 'COMMISSIONER_BRIEF');

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 sm:pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 200, damping: 20 }}
        className="mb-6"
      >
        <h1 className="font-barlow font-extrabold text-2xl sm:text-3xl uppercase tracking-wide text-text-primary">
          {t('lockerRoomTitle')}
        </h1>
        <div
          className="mt-2 h-0.5 w-16 rounded-full"
          style={{
            background: 'linear-gradient(to right, var(--color-accent-green), transparent)',
          }}
        />
      </motion.div>

      {latestBrief && (
        <VoiceRadioPlayer
          textEn={String(latestBrief.metadata.text_en ?? '')}
          textHe={String(latestBrief.metadata.text_he ?? '')}
          themeEn={latestBrief.metadata.theme_en != null ? String(latestBrief.metadata.theme_en) : null}
          themeHe={latestBrief.metadata.theme_he != null ? String(latestBrief.metadata.theme_he) : null}
        />
      )}
      <MomentumBanner />
      <BattleMeter />
      <SyndicatePoolCard />

      {/* Feed */}
      <ActivityFeed />
    </div>
  );
}
