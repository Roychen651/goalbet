import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';

const SESSION_KEY = 'goalbet_welcomed';

// Cold Sea Navy palette
const ICE  = 'rgba(189,232,245,';
const STEEL = 'rgba(73,136,196,';

export function WelcomeAnimation() {
  const { profile } = useAuthStore();
  const { lang } = useLangStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const seen = sessionStorage.getItem(SESSION_KEY);
    if (!seen) {
      setVisible(true);
      sessionStorage.setItem(SESSION_KEY, '1');
      const t = setTimeout(() => setVisible(false), 2800);
      return () => clearTimeout(t);
    }
  }, [profile]);

  const firstName = profile?.username?.split(' ')[0] ?? '';
  const greeting = lang === 'he' ? `שלום, ${firstName}! 👋` : `Welcome back, ${firstName}! 👋`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } }}
          onClick={() => setVisible(false)}
        >
          {/* Backdrop — deep navy */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 140% 100% at 50% 0%, #0F2854 0%, #0a1733 55%, #060e24 100%)',
            }}
          />

          {/* Ice-blue stadium bloom — top */}
          <motion.div
            className="absolute pointer-events-none"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            style={{
              top: '-10%', left: '50%', transform: 'translateX(-50%)',
              width: '700px', height: '500px', borderRadius: '50%',
              background: `radial-gradient(ellipse, ${ICE}0.13) 0%, transparent 70%)`,
              filter: 'blur(72px)',
            }}
          />

          {/* Steel-blue bloom — bottom */}
          <motion.div
            className="absolute pointer-events-none"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.7 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.1 }}
            style={{
              bottom: '-15%', left: '50%', transform: 'translateX(-50%)',
              width: '600px', height: '400px', borderRadius: '50%',
              background: `radial-gradient(ellipse, ${STEEL}0.10) 0%, transparent 70%)`,
              filter: 'blur(80px)',
            }}
          />

          {/* Floating particles — ice blue + steel blue, no orange */}
          {[...Array(14)].map((_, i) => {
            const isIce = i % 3 !== 2;
            const color  = isIce ? `${ICE}0.65)`  : `${STEEL}0.60)`;
            const glow   = isIce ? `${ICE}0.45)`  : `${STEEL}0.40)`;
            const size   = i % 3 === 0 ? '6px' : '4px';
            return (
              <motion.div
                key={i}
                className="absolute rounded-full pointer-events-none"
                initial={{ y: 40, opacity: 0, scale: 0 }}
                animate={{
                  y: [40, -130 - i * 10],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0.2],
                  x: [(i % 2 === 0 ? 1 : -1) * i * 14],
                }}
                transition={{
                  duration: 2.6,
                  delay: 0.15 + i * 0.1,
                  ease: 'easeOut',
                  repeat: Infinity,
                  repeatDelay: 0.4,
                }}
                style={{
                  width: size, height: size,
                  left: `${18 + i * 5}%`,
                  top: '56%',
                  background: color,
                  boxShadow: `0 0 8px ${glow}`,
                }}
              />
            );
          })}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center text-center px-8 select-none">
            {/* Football */}
            <motion.div
              initial={{ y: -80, opacity: 0, rotate: -30 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
              className="text-6xl mb-4"
              style={{ filter: `drop-shadow(0 0 28px ${ICE}0.50))` }}
            >
              ⚽
            </motion.div>

            {/* Logo */}
            <motion.div
              className="flex items-baseline mb-6"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.2 }}
            >
              <span
                className="font-bebas text-[64px] sm:text-[80px] leading-none tracking-widest text-white"
                style={{ textShadow: '0 0 40px rgba(255,255,255,0.08)' }}
              >
                GOAL
              </span>
              <span
                className="font-bebas text-[64px] sm:text-[80px] leading-none tracking-widest"
                style={{
                  color: '#BDE8F5',
                  textShadow: `0 0 28px ${ICE}0.65), 0 0 56px ${ICE}0.25)`,
                }}
              >
                BET
              </span>
            </motion.div>

            {/* Greeting */}
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.4 }}
              className="text-white text-xl sm:text-2xl font-semibold leading-snug"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}
            >
              {greeting}
            </motion.p>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
              style={{ color: `${ICE}0.55)` }}
              className="text-sm mt-2"
            >
              {lang === 'he' ? 'מוכן לנבא?' : 'Ready to predict?'}
            </motion.p>

            {/* Dismiss hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.4 }}
              style={{ color: `${ICE}0.28)` }}
              className="text-xs mt-8"
            >
              {lang === 'he' ? 'לחץ לדלג' : 'tap to skip'}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
