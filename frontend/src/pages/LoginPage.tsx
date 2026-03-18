import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { LangToggle } from '../components/ui/LangToggle';
import { useAuthStore } from '../stores/authStore';
import { useLangStore } from '../stores/langStore';
import { ROUTES } from '../lib/constants';

// Stagger container for the main content block
const contentVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 80, damping: 18 },
  },
};

const ballVariants = {
  hidden: { opacity: 0, y: -80, rotate: -20 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 14, delay: 0.1 },
  },
};

export function LoginPage() {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useLangStore();

  useEffect(() => {
    if (!loading && user) navigate(ROUTES.HOME, { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-bg-base">

      {/* ── Ambient orbs ── */}
      <div
        className="absolute -top-32 -start-32 w-[600px] h-[600px] rounded-full pointer-events-none animate-orb-drift"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,135,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute -bottom-40 -end-20 w-[700px] h-[700px] rounded-full pointer-events-none animate-orb-drift-rev"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,53,0.10) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none animate-glow-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(100,50,255,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* ── Stadium light beams (top corners) ── */}
      <div
        className="absolute top-0 start-0 w-px h-64 origin-top pointer-events-none animate-beam opacity-30"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,255,135,0.6), transparent)',
          transform: 'rotate(15deg) translateX(80px)',
          width: '1px',
        }}
      />
      <div
        className="absolute top-0 end-0 w-px h-64 origin-top pointer-events-none animate-beam opacity-30"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,255,135,0.6), transparent)',
          transform: 'rotate(-15deg) translateX(-80px)',
          width: '1px',
          animationDelay: '2s',
        }}
      />

      {/* ── Rising particles ── */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute bottom-0 rounded-full pointer-events-none"
          style={{
            left: `${8 + i * 8}%`,
            width: i % 3 === 0 ? '3px' : '2px',
            height: i % 3 === 0 ? '3px' : '2px',
            background: i % 2 === 0 ? 'rgba(0,255,135,0.5)' : 'rgba(255,107,53,0.4)',
            animation: `rise ${6 + (i % 4) * 2}s linear ${i * 0.7}s infinite`,
          }}
        />
      ))}

      {/* ── Stadium grid ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* ── Noise grain overlay ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-stadium-noise" />

      {/* ── Language toggle ── */}
      <div className="absolute top-5 end-5 z-20">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.4 }}
        >
          <LangToggle />
        </motion.div>
      </div>

      {/* ── Main content ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center px-8 text-center max-w-sm w-full"
        variants={contentVariants}
        initial="hidden"
        animate="show"
      >
        {/* Ball */}
        <motion.div
          className="text-7xl mb-6 drop-shadow-[0_0_30px_rgba(0,255,135,0.4)]"
          variants={ballVariants}
          animate={{
            y: [0, -12, 0],
            rotate: [0, 5, -3, 0],
          }}
          transition={{
            y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 },
            rotate: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 },
          }}
        >
          ⚽
        </motion.div>

        {/* Logo — GOAL from left, BET from right */}
        <motion.div className="flex items-baseline mb-3 overflow-hidden" variants={itemVariants}>
          <motion.span
            className="font-bebas text-[72px] leading-none tracking-widest text-white"
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.4 }}
          >
            GOAL
          </motion.span>
          <motion.span
            className="font-bebas text-[72px] leading-none tracking-widest text-accent-green"
            style={{ textShadow: '0 0 30px rgba(0,255,135,0.5), 0 0 60px rgba(0,255,135,0.2)' }}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.4 }}
          >
            BET
          </motion.span>
        </motion.div>

        {/* Tagline */}
        <motion.p className="text-white/80 text-lg font-medium mb-2" variants={itemVariants}>
          {t('appTagline')}
        </motion.p>
        <motion.p className="text-text-muted text-sm mb-10 max-w-[260px] leading-relaxed" variants={itemVariants}>
          {t('appDescription')}
        </motion.p>

        {/* CTA */}
        <motion.div className="w-full max-w-xs" variants={itemVariants}>
          <GoogleLoginButton />
        </motion.div>

        {/* Feature icons */}
        <motion.div
          className="mt-12 grid grid-cols-3 gap-4 w-full"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
        >
          {[
            { icon: '🎯', label: t('multiTierPredictions') },
            { icon: '🏆', label: t('liveLeaderboard') },
            { icon: '🚩', label: t('cornersFeature') },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              variants={itemVariants}
              whileHover={{ scale: 1.08, y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-white/5 bg-white/[0.03] cursor-default"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-text-muted text-xs text-center whitespace-pre-line leading-tight">
                {item.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* ── Bottom gradient vignette ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(10,10,15,0.8), transparent)' }}
      />
    </div>
  );
}
