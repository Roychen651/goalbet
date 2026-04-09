import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';

/**
 * SyncProgressBar — YouTube-style indeterminate shimmer at the top of the page.
 * Visible only while isSyncing is true (backend cold-start window).
 * Fades out instantly on first successful sync response.
 */
export function SyncProgressBar() {
  const isSyncing = useUIStore(s => s.isSyncing);

  return (
    <AnimatePresence>
      {isSyncing && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-y-0 w-2/5 rounded-full"
            style={{ background: 'var(--color-accent-green)' }}
            animate={{ left: ['-40%', '100%'] }}
            transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.2 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
