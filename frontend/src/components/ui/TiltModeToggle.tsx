import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { useTiltStore } from '../../stores/tiltStore';
import { requestTiltPermission, isTiltSupported } from '../../lib/tiltPermission';
import { cn } from '../../lib/utils';
import { GlassCard } from './GlassCard';

/**
 * Sprint 16 Commit 3 — opt-in gyroscope tilt, mirroring PushToggle.tsx's
 * exact shape (the established pattern in this codebase for any
 * permission-gated browser capability): self-hides where unsupported,
 * requests permission on tap (required for iOS — see lib/tiltPermission.ts),
 * shows a denial hint rather than nothing.
 *
 * Deliberately does NOT enable gyroscope tilt on the whole Bento grid —
 * only the hero card opts into allowGyroscope (BentoArena.tsx). Tilting six
 * cards at once against phone orientation while the hand is also scrolling
 * is a real motion-sickness risk for a grid, not just a performance
 * question — this toggle controls a single focused card, by design.
 */
export function TiltModeToggle() {
  const { t } = useLangStore();
  const { addToast } = useUIStore();
  const { gyroscopeEnabled, setGyroscopeEnabled } = useTiltStore();
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isTiltSupported()) return null;

  const toggle = async () => {
    if (gyroscopeEnabled) {
      setGyroscopeEnabled(false);
      addToast(t('tiltDisabledToast'), 'success');
      return;
    }
    setBusy(true);
    try {
      const status = await requestTiltPermission();
      if (status === 'granted' || status === 'not-needed') {
        setGyroscopeEnabled(true);
        setDenied(false);
        addToast(t('tiltEnabledToast'), 'success');
      } else if (status === 'denied') {
        setDenied(true);
        addToast(t('tiltDenied'), 'error');
      } else {
        addToast(t('tiltFailedToast'), 'error');
      }
    } catch {
      addToast(t('tiltFailedToast'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-green/10 flex items-center justify-center shrink-0">
          <Smartphone size={18} className="text-accent-green" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{t('tiltTitle')}</div>
          <div className="text-xs text-text-muted mt-0.5">{denied ? t('tiltDenied') : t('tiltSubtitle')}</div>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50',
            gyroscopeEnabled
              ? 'bg-white/8 text-text-muted border border-white/15'
              : 'bg-accent-green text-bg-base',
          )}
        >
          {busy ? '···' : gyroscopeEnabled ? t('tiltDisable') : t('tiltEnable')}
        </button>
      </div>
    </GlassCard>
  );
}
