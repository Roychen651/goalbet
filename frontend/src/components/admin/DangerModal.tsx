import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DangerModalProps {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmLabel?: string;
}

export function DangerModal({
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
}: DangerModalProps) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  const confirmed = typed === 'DELETE';

  const handleConfirm = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Card */}
        <motion.div
          className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0f0a0a] p-6 shadow-2xl"
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {/* Warning icon */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">
            ⚠️
          </div>

          <h2 className="mb-1 text-lg font-semibold text-white">{title}</h2>
          <p className="mb-5 text-sm leading-relaxed text-white/50">{description}</p>

          {/* Type-to-confirm */}
          <div className="mb-4">
            <p className="mb-2 text-xs text-white/40">
              Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
            </p>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm
                         text-white placeholder-white/20 outline-none
                         focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60
                         transition-all hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!confirmed || loading}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white
                         transition-all hover:bg-red-500 disabled:cursor-not-allowed
                         disabled:opacity-30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting…
                </span>
              ) : confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
