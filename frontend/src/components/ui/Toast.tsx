import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, type LucideIcon } from 'lucide-react';
import { useUIStore, Toast } from '../../stores/uiStore';

// Sprint 17 Commit 2 — stacked, swipeable, OKLCH-themed toasts. Rewritten in
// place rather than replaced with a third-party toast library (Sonner):
// every gap here (stacking, exit animation, swipe-to-dismiss) is a Framer
// Motion feature, and Framer Motion is already the loaded vendor-framer
// chunk every bottom-sheet in this codebase already uses for the identical
// drag-to-dismiss gesture (rule 4.13). Introducing a second library would
// make toasts the one overlay following a different animation model than
// every other surface in the app, not just cost bundle KB.
//
// uiStore.ts's public API (addToast/removeToast) is unchanged — every
// existing call site keeps working with zero edits.

const ICONS: Record<Toast['type'], LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

// Warning has no existing site-wide accent token (success/error map to the
// green/orange accents already used everywhere); #FFC94A is the same gold
// already used for World Cup/momentum "urgent" accents elsewhere in index.css,
// not a new one-off color.
const TONE: Record<Toast['type'], string> = {
  success: 'var(--color-accent-green)',
  error: 'var(--color-accent-orange)',
  warning: '#FFC94A',
  info: 'var(--color-text-muted)',
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-24 start-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none sm:bottom-6 sm:end-4 sm:start-auto sm:translate-x-0">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = ICONS[toast.type];
  const tone = TONE[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={(_, info) => {
        // Physical swipe-dismiss — same offset/velocity threshold shape as
        // MomentumBetSheet.tsx's vertical drag-to-close, just on the x-axis
        // (toasts dismiss sideways; bottom sheets dismiss downward — distinct
        // gestures so muscle memory for one never fights the other).
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 400) onClose();
      }}
      onClick={onClose}
      className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl min-w-[240px] max-w-[360px] backdrop-blur-glass border shadow-card cursor-grab active:cursor-grabbing"
      style={{
        background: `color-mix(in oklch, ${tone} 14%, var(--color-bg-card))`,
        borderColor: `color-mix(in oklch, ${tone} 35%, transparent)`,
      }}
    >
      <Icon size={18} style={{ color: tone }} className="shrink-0" />
      <span className="text-sm font-medium flex-1 text-text-primary">{toast.message}</span>
    </motion.div>
  );
}
