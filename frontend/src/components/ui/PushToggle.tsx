import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { getPushStatus, enablePush, disablePush, type PushStatus } from '../../lib/push';
import { cn } from '../../lib/utils';
import { GlassCard } from './GlassCard';

/**
 * Match-reminder push toggle. Renders nothing until support is known, and stays
 * hidden entirely where Web Push is unavailable (no API, or VAPID key unset) —
 * graceful degradation, no dead controls.
 */
export function PushToggle() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const { t } = useLangStore();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus);
  }, []);

  if (status === null || status === 'unsupported') return null;

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (status === 'subscribed') {
        await disablePush();
        setStatus('default');
        addToast(t('pushDisabledToast'), 'success');
      } else {
        await enablePush(user.id);
        setStatus('subscribed');
        addToast(t('pushEnabledToast'), 'success');
      }
    } catch (err) {
      addToast(
        err instanceof Error && err.message === 'permission-denied' ? t('pushDenied') : t('pushFailedToast'),
        'error',
      );
      setStatus(await getPushStatus());
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    status === 'ios-needs-install' ? t('pushIosHint')
    : status === 'denied' ? t('pushDenied')
    : t('pushSubtitle');

  const actionable = status !== 'ios-needs-install' && status !== 'denied';

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-orange/10 flex items-center justify-center shrink-0">
          <Bell size={18} className="text-accent-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{t('pushTitle')}</div>
          <div className="text-xs text-text-muted mt-0.5">{subtitle}</div>
        </div>
        {actionable && (
          <button
            onClick={toggle}
            disabled={busy}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50',
              status === 'subscribed'
                ? 'bg-white/8 text-text-muted border border-white/15'
                : 'bg-accent-green text-bg-base',
            )}
          >
            {busy ? '···' : status === 'subscribed' ? t('pushDisable') : t('pushEnable')}
          </button>
        )}
      </div>
    </GlassCard>
  );
}
