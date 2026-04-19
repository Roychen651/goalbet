/**
 * HTAnalystCard — Broadcast-TV lower-third overlay for the AI half-time tactical
 * read. Distinct from AIScoutCard on purpose: this is a LIVE OVERLAY while the
 * match is in the break, not a pre/post-match insight box.
 *
 * Aesthetic:
 *  - Pure black glass (bg-black/60) + backdrop-blur-2xl — sits over the card
 *    like a broadcast graphic rather than blending with the team palette.
 *  - Animated conic-gradient running neon pulse border (red → amber → cyan),
 *    rotates faster than AIScoutCard to feel urgent/live.
 *  - Pulsing red "● LIVE AI READ" badge in Bebas Neue.
 *  - Typewriter-style word-by-word fade-in driven by Framer Motion stagger.
 *
 * Returns null when `text` is empty so the UI hides gracefully if Groq failed.
 */
import { motion } from 'framer-motion';
import { useLangStore } from '../../stores/langStore';

export function HTAnalystCard({ text }: { text: string | null | undefined }) {
  const { t, lang } = useLangStore();
  if (!text || !text.trim()) return null;

  // Split into words for the typewriter stagger. Keeps punctuation attached to
  // the preceding word so visual rhythm isn't broken by lone commas/periods.
  const words = text.trim().split(/\s+/);

  const isRTL = lang === 'he';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: 'easeOut' as const }}
      className="relative rounded-2xl p-[1.5px] overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Rotating broadcast neon border — red/amber/cyan */}
      <motion.span
        aria-hidden
        className="absolute inset-[-55%]"
        style={{
          background:
            'conic-gradient(from 0deg,' +
            ' rgba(255,77,102,0.0) 0%,' +
            ' rgba(255,77,102,0.95) 12%,' +
            ' rgba(255,201,74,0.75) 28%,' +
            ' rgba(189,232,245,0.85) 48%,' +
            ' rgba(255,77,102,0.55) 66%,' +
            ' rgba(255,201,74,0.0) 82%,' +
            ' rgba(255,77,102,0.0) 100%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4.2, ease: 'linear', repeat: Infinity }}
      />

      {/* Pure black broadcast glass — no team-palette tint */}
      <div
        className="relative rounded-[calc(1rem-1.5px)] backdrop-blur-2xl overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(4,8,16,0.70) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px -22px rgba(0,0,0,0.75)',
        }}
      >
        {/* Subtle scanline overlay for broadcast feel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)',
          }}
        />

        <div className="relative px-3.5 pt-2.5 pb-3">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex items-center gap-1.5">
              {/* Pulsing red dot */}
              <span className="relative inline-flex w-1.5 h-1.5">
                <motion.span
                  className="absolute inset-0 rounded-full bg-[#FF4D66]"
                  animate={{ scale: [1, 1.9, 1], opacity: [0.9, 0.25, 0.9] }}
                  transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
                />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#FF4D66] shadow-[0_0_6px_rgba(255,77,102,0.9)]" />
              </span>
              <span
                className="font-bebas text-[11px] tracking-[0.28em] text-white/95"
                style={{
                  textShadow: '0 0 10px rgba(255,77,102,0.35)',
                }}
              >
                {t('aiLiveReadLabel')}
              </span>
            </span>

            {/* Right-aligned title — gradient text */}
            <span
              className="ms-auto font-barlow text-[10px] uppercase tracking-[0.22em] font-bold"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, #FFC94A 0%, #BDE8F5 55%, #FF4D66 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('aiHTAnalystTitle')}
            </span>
          </div>

          {/* Typewriter read-out */}
          <motion.p
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.035, delayChildren: 0.15 } },
            }}
            className="text-[13.5px] leading-snug text-white font-display"
            style={{ textShadow: '0 0 14px rgba(189,232,245,0.12)' }}
          >
            {words.map((w, i) => (
              <motion.span
                key={`${i}-${w}`}
                variants={{
                  hidden: { opacity: 0, y: 4, filter: 'blur(2px)' },
                  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
                }}
                transition={{ duration: 0.32, ease: 'easeOut' as const }}
                className="inline"
              >
                {w}
                {i < words.length - 1 ? ' ' : ''}
              </motion.span>
            ))}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
