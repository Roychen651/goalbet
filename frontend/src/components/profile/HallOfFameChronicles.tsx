/**
 * HallOfFameChronicles — Mythic sagas celebrating the user's perfect +10
 * predictions on high-profile matches. Sprint 27.
 *
 * Cards use real 3D perspective (1200px) + Framer Motion rotateX/Y driven by
 * mouse position (desktop) and touch on mobile. Each card is a broadcast-
 * gold/crimson artefact — not another glass square. Renders null when the
 * user has zero chronicles (don't advertise an empty hall of fame).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { supabase, type Chronicle } from '../../lib/supabase';
import { useLangStore } from '../../stores/langStore';

interface Props {
  userId: string;
}

export function HallOfFameChronicles({ userId }: Props) {
  const { t, lang } = useLangStore();
  const [chronicles, setChronicles] = useState<Chronicle[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('user_chronicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (cancelled) return;
        setChronicles((data as Chronicle[]) ?? []);
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (!chronicles || chronicles.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.2 }}
      className="space-y-3"
    >
      {/* Section header — gold/crimson brand break */}
      <div className="flex items-center gap-2">
        <Trophy size={14} className="text-[#FFC94A] drop-shadow-[0_0_10px_rgba(255,201,74,0.55)]" />
        <span
          className="font-bebas text-base tracking-[0.24em]"
          style={{
            backgroundImage: 'linear-gradient(120deg, #FFC94A 0%, #FF4D66 55%, #FFC94A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {t('chroniclesTitle')}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-[#FFC94A]/35 via-[#FF4D66]/20 to-transparent" />
        <span className="text-white/35 text-[10px] font-barlow tracking-widest">
          {chronicles.length}
        </span>
      </div>

      {/* Horizontal scroll-snap carousel — data-lenis-prevent lets trackpad/wheel scroll it */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory overscroll-contain"
        data-lenis-prevent
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`.chronicles-rail::-webkit-scrollbar { display: none; }`}</style>
        <AnimatePresence initial={false}>
          {chronicles.map((ch, i) => (
            <ChronicleCard key={ch.id} chronicle={ch} index={i} lang={lang} />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

// ── Individual card with 3D tilt ─────────────────────────────────────────────

function ChronicleCard({
  chronicle,
  index,
  lang,
}: {
  chronicle: Chronicle;
  index: number;
  lang: 'en' | 'he';
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Raw mouse position → normalized [0..1] within the card
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  // Smoothed springs so the tilt feels heavy & expensive, not twitchy
  const smx = useSpring(mx, { stiffness: 140, damping: 18 });
  const smy = useSpring(my, { stiffness: 140, damping: 18 });

  const rotateY = useTransform(smx, [0, 1], [-10, 10]);
  const rotateX = useTransform(smy, [0, 1], [8, -8]);

  // Glare position follows the cursor for a liquid metal feel
  const glareX = useTransform(smx, [0, 1], ['0%', '100%']);
  const glareY = useTransform(smy, [0, 1], ['0%', '100%']);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    my.set(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
  };

  const handlePointerLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  const text = (lang === 'he' && chronicle.epic_text_he) || chronicle.epic_text;
  const predicted =
    chronicle.predicted_home !== null && chronicle.predicted_away !== null
      ? `${chronicle.predicted_home}–${chronicle.predicted_away}`
      : null;

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={e => e.stopPropagation()}
      initial={{ opacity: 0, y: 22, rotateX: -20 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.05 * index }}
      className="snap-start shrink-0 w-[285px] sm:w-[320px]"
      style={{
        perspective: 1200,
        transformStyle: 'preserve-3d',
      }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="relative rounded-2xl p-[1.5px] overflow-hidden"
      >
        {/* Rotating gold/crimson neon border */}
        <motion.span
          aria-hidden
          className="absolute inset-[-40%]"
          style={{
            background:
              'conic-gradient(from 0deg,' +
              ' rgba(255,201,74,0.0) 0%,' +
              ' rgba(255,201,74,0.9) 14%,' +
              ' rgba(255,77,102,0.75) 34%,' +
              ' rgba(255,201,74,0.85) 54%,' +
              ' rgba(255,77,102,0.55) 74%,' +
              ' rgba(255,201,74,0.0) 92%,' +
              ' rgba(255,201,74,0.0) 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
        />

        {/* Inner artefact — deep gold/crimson radial glass */}
        <div
          className="relative rounded-[calc(1rem-1.5px)] overflow-hidden border border-white/10"
          style={{
            background:
              'radial-gradient(circle at 20% 0%, rgba(255,201,74,0.22) 0%, transparent 55%),' +
              ' radial-gradient(circle at 90% 100%, rgba(255,77,102,0.28) 0%, transparent 58%),' +
              ' linear-gradient(180deg, rgba(12,7,22,0.92) 0%, rgba(24,8,20,0.94) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,215,130,0.18), inset 0 -30px 60px -30px rgba(255,77,102,0.22), 0 24px 48px -24px rgba(0,0,0,0.9)',
          }}
        >
          {/* Cursor-tracking glare */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background: useTransform(
                [glareX, glareY] as unknown as [typeof glareX, typeof glareY],
                ([x, y]: unknown[]) =>
                  `radial-gradient(circle at ${x} ${y}, rgba(255,235,180,0.22) 0%, rgba(255,235,180,0) 45%)`,
              ),
              mixBlendMode: 'screen',
            }}
          />

          {/* Grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
            style={{
              backgroundImage:
                'repeating-radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0) 1.5px, transparent 3px)',
            }}
          />

          <div className="relative p-4 min-h-[188px] flex flex-col">
            {/* Title — engraved gold */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3
                className="font-bebas text-[17px] leading-tight tracking-wide flex-1 min-w-0"
                style={{
                  backgroundImage: 'linear-gradient(180deg, #FFE9A8 0%, #FFC94A 55%, #D89536 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                  transform: 'translateZ(30px)',
                }}
              >
                {chronicle.title}
              </h3>
              {predicted && (
                <span
                  className="shrink-0 font-bebas text-[15px] tabular-nums px-2 py-0.5 rounded-md"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,201,74,0.15) 0%, rgba(255,77,102,0.15) 100%)',
                    border: '1px solid rgba(255,201,74,0.35)',
                    color: '#FFE9A8',
                    transform: 'translateZ(24px)',
                  }}
                >
                  {predicted}
                </span>
              )}
            </div>

            {/* Epic text — inner-shadow for engraved feel */}
            <p
              className="flex-1 text-[12.5px] leading-relaxed text-white/85 font-display"
              style={{
                textShadow: '0 1px 0 rgba(0,0,0,0.55), 0 0 22px rgba(255,201,74,0.06)',
                transform: 'translateZ(18px)',
              }}
            >
              {text}
            </p>

            {/* Footer — date + points stamp */}
            <div
              className="mt-3 flex items-center justify-between pt-2 border-t border-white/8"
              style={{ transform: 'translateZ(14px)' }}
            >
              <span className="text-white/40 text-[10px] font-barlow tracking-widest uppercase">
                {new Date(chronicle.created_at).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span
                className="font-bebas text-[13px] tracking-widest"
                style={{
                  backgroundImage: 'linear-gradient(120deg, #FFC94A 0%, #FF4D66 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                +{chronicle.points_earned} PTS
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
