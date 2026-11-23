import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import type { TranslationKey } from '../../lib/i18n';

/**
 * AIScoutCard — crisp, editorial card for generative match insight.
 *
 * Full-app audit, Nov 2026 — "Purge Generic AI Design": the previous version
 * wrapped a rotating conic-gradient border around every pre/post-match
 * insight, the exact "many competing glows" complaint the audit named.
 * Rotating/animated borders are now reserved strictly for genuinely
 * live-in-play elements (HTAnalystCard during HT, MomentumBanner while a
 * question is open/locked) — a pre-match tip or a post-match recap isn't
 * happening right now, so it doesn't get a "live broadcast" treatment. This
 * card instead uses a crisp 1px hairline (var(--color-border-subtle), the
 * same token every other calm surface in this app already uses) and a
 * sharp, static mono broadcast-style tag ("SCOUT // PRE-MATCH") in place of
 * the gradient-text label + wobbling sparkle icon.
 *
 * Renders nothing when `text` is falsy so the UI disappears gracefully if
 * the backend couldn't generate an insight (Groq failure, rate-limit, etc.).
 */
export function AIScoutCard({
  title,
  text,
  tone = 'pre',
}: {
  title: TranslationKey;
  text: string | null | undefined;
  tone?: 'pre' | 'post';
}) {
  const { t } = useLangStore();
  if (!text || !text.trim()) return null;

  const broadcastTag = tone === 'pre' ? t('aiScoutBroadcastPre') : t('aiScoutBroadcastPost');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' as const }}
      className="relative rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <div
        className="relative rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(15,40,84,0.85) 0%, rgba(10,23,51,0.78) 55%, rgba(15,40,84,0.85) 100%)',
        }}
      >
        <div className="flex items-start gap-2.5 p-3">
          <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full border border-white/10 bg-white/5">
            <Sparkles size={14} className="text-accent-green" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-accent-green">
                {broadcastTag}
              </span>
              <span className="text-[10px] font-mono text-white/35">· {t(title)}</span>
            </div>
            <p className="text-[13px] leading-snug text-white/90 font-display">
              {text.trim()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
