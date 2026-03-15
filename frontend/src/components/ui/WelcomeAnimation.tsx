import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';

const SESSION_KEY = 'goalbet_welcomed';

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
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 120% 120% at 50% 50%, rgba(8,13,10,0.97) 0%, rgba(5,8,6,0.99) 100%)',
            }}
          />

          {/* Ambient green orb */}
          <motion.div
            className="absolute pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.4 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,255,135,0.18) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Floating particles */}
          {[...Array(14)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full pointer-events-none"
              initial={{ y: 40, opacity: 0, scale: 0 }}
              animate={{
                y: [40, -120 - i * 12],
                opacity: [0, 0.7, 0],
                scale: [0, 1, 0.3],
                x: [(i % 2 === 0 ? 1 : -1) * i * 15],
              }}
              transition={{
                duration: 2.5,
                delay: 0.2 + i * 0.1,
                ease: 'easeOut',
                repeat: Infinity,
                repeatDelay: 0.3,
              }}
              style={{
                width: i % 3 === 0 ? '6px' : '4px',
                height: i % 3 === 0 ? '6px' : '4px',
                left: `${20 + i * 5}%`,
                top: '55%',
                background: i % 2 === 0 ? 'rgba(0,255,135,0.6)' : 'rgba(255,107,53,0.5)',
                boxShadow: i % 2 === 0 ? '0 0 8px rgba(0,255,135,0.5)' : '0 0 8px rgba(255,107,53,0.4)',
              }}
            />
          ))}

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center text-center px-8 select-none">
            {/* Football */}
            <motion.div
              initial={{ y: -80, opacity: 0, rotate: -30 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
              className="text-6xl mb-4"
              style={{ filter: 'drop-shadow(0 0 24px rgba(0,255,135,0.5))' }}
            >
              ⚽
            </motion.div>

            {/* Logo */}
            <motion.div
              className="flex items-baseline mb-6 overflow-hidden"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.2 }}
            >
              <span
                className="font-bebas text-[64px] sm:text-[80px] leading-none tracking-widest text-white"
                style={{ textShadow: '0 0 40px rgba(255,255,255,0.1)' }}
              >
                GOAL
              </span>
              <span
                className="font-bebas text-[64px] sm:text-[80px] leading-none tracking-widest"
                style={{
                  color: '#00ff87',
                  textShadow: '0 0 30px rgba(0,255,135,0.7), 0 0 60px rgba(0,255,135,0.3)',
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
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}
            >
              {greeting}
            </motion.p>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
              className="text-white text-sm mt-2"
            >
              {lang === 'he' ? 'מוכן לנבא?' : "Ready to predict?"}
            </motion.p>

            {/* Dismiss hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 1.2, duration: 0.4 }}
              className="text-white text-xs mt-8"
            >
              {lang === 'he' ? 'לחץ לדלג' : 'tap to skip'}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
