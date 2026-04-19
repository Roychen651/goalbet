import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import type { TranslationKey } from '../../lib/i18n';

/**
 * AIScoutCard — "Apple Intelligence"–styled card for generative match insight.
 *
 * Hosts a sparkle icon, a localized title, and the generated text on a soft
 * glass surface wrapped in a conic-gradient animated border. The animated
 * border is a single rotating layer behind a dark inner card — cheap on the
 * compositor, no per-pixel blur.
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' as const }}
      className="relative rounded-2xl p-[1.5px] overflow-hidden"
    >
      {/* Animated conic-gradient border layer */}
      <motion.span
        aria-hidden
        className="absolute inset-[-50%]"
        style={{
          background:
            tone === 'pre'
              ? 'conic-gradient(from 0deg, rgba(189,232,245,0.0) 0%, rgba(189,232,245,0.85) 18%, rgba(73,136,196,0.55) 36%, rgba(192,132,252,0.65) 58%, rgba(189,232,245,0.0) 78%, rgba(189,232,245,0.0) 100%)'
              : 'conic-gradient(from 0deg, rgba(189,232,245,0.0) 0%, rgba(255,201,74,0.55) 18%, rgba(189,232,245,0.70) 40%, rgba(255,77,102,0.45) 62%, rgba(189,232,245,0.0) 82%, rgba(189,232,245,0.0) 100%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 7, ease: 'linear', repeat: Infinity }}
      />

      {/* Inner glass card */}
      <div
        className="relative rounded-[calc(1rem-1.5px)] backdrop-blur-xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(15,40,84,0.85) 0%, rgba(10,23,51,0.78) 55%, rgba(15,40,84,0.85) 100%)',
        }}
      >
        <div className="flex items-start gap-2.5 p-3">
          <div className="shrink-0 mt-0.5">
            <motion.span
              className="relative inline-flex items-center justify-center w-7 h-7 rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, rgba(189,232,245,0.22) 0%, rgba(192,132,252,0.22) 100%)',
                border: '1px solid rgba(189,232,245,0.35)',
              }}
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 4.4, ease: 'easeInOut', repeat: Infinity }}
            >
              <Sparkles size={14} className="text-accent-green drop-shadow-[0_0_6px_rgba(189,232,245,0.8)]" />
            </motion.span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[10px] font-barlow font-bold uppercase tracking-[0.22em]"
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, #BDE8F5 0%, #C084FC 50%, #BDE8F5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('aiScoutLabel')} · {t(title)}
              </span>
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
