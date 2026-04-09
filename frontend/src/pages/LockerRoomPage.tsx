import { motion } from 'framer-motion';
import { useLangStore } from '../stores/langStore';
import { ActivityFeed } from '../components/groups/ActivityFeed';

export function LockerRoomPage() {
  const { t } = useLangStore();

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

      {/* Feed */}
      <ActivityFeed />
    </div>
  );
}
