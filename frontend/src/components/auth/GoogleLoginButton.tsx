import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { GlassCard } from '../ui/GlassCard';
import { NeonButton } from '../ui/NeonButton';

const PLACEHOLDER_URL = 'placeholder.supabase.co';

function isPlaceholderConfig(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  return url.includes(PLACEHOLDER_URL) || url === '' || url === 'https://placeholder.supabase.co';
}

export function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const { signInWithGoogle } = useAuthStore();
  const { t } = useLangStore();

  const handleLogin = async () => {
    // Guard: show setup instructions if not configured
    if (isPlaceholderConfig()) {
      setShowSetupModal(true);
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleLogin}
        disabled={loading}
        className="group relative flex items-center justify-center gap-3 w-full max-w-xs px-6 py-4 rounded-2xl font-dm font-semibold text-base transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed bg-white text-gray-900 hover:bg-gray-100 hover:shadow-glow-green hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading ? (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>{loading ? t('signingIn') : t('continueWithGoogle')}</span>
      </button>

      {showSetupModal && <SetupModal onClose={() => setShowSetupModal(false)} />}
    </>
  );
}

function SetupModal({ onClose }: { onClose: () => void }) {
  const { t } = useLangStore();

  const steps = [
    t('setupStep1'),
    t('setupStep2'),
    t('setupStep3'),
    t('setupStep4'),
    t('setupStep5'),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <GlassCard
        variant="elevated"
        className="w-full max-w-sm p-6 space-y-4 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl mb-1">⚙️</div>
            <h2 className="font-bebas text-2xl tracking-wider text-white">{t('setupRequired')}</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white text-xl leading-none p-1">✕</button>
        </div>

        <p className="text-text-muted text-sm">{t('setupDescription')}</p>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-xl bg-white/5 border border-white/8">
              <span className="text-accent-green text-xs font-bold mt-0.5 shrink-0">{i + 1}</span>
              <span className="text-white/80 text-sm">{step.replace(/^\d+\.\s*/, '')}</span>
            </div>
          ))}
        </div>

        {/* README link */}
        <a
          href="/README.md"
          target="_blank"
          rel="noreferrer"
          className="block text-center text-accent-green text-sm hover:underline"
        >
          {t('viewReadme')}
        </a>

        <NeonButton variant="green" onClick={onClose} className="w-full">
          {t('gotIt')}
        </NeonButton>
      </GlassCard>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
