import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { NeonButton } from '../ui/NeonButton';
import { GlassCard } from '../ui/GlassCard';

interface JoinGroupModalProps {
  onClose: () => void;
}

export function JoinGroupModal({ onClose }: JoinGroupModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { joinGroup } = useGroupStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const { t } = useLangStore();

  const handleJoin = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);
    try {
      const group = await joinGroup(code.trim(), user.id);
      addToast(`${t('joinedGroup')} "${group.name}"!`, 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Invalid invite code', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <GlassCard
        variant="elevated"
        className="w-full max-w-sm p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="font-bebas text-2xl tracking-wider text-white">{t('joinGroupTitle')}</h2>
          <p className="text-text-muted text-sm mt-1">{t('joinGroupDesc')}</p>
        </div>

        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder={t('inviteCodePlaceholder')}
          maxLength={8}
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-xl tracking-widest font-bebas placeholder:text-white/20 placeholder:text-base placeholder:font-dm placeholder:tracking-normal focus:outline-none focus:border-accent-green transition-colors"
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />

        <div className="flex gap-3">
          <NeonButton variant="ghost" onClick={onClose} className="flex-1">{t('cancel')}</NeonButton>
          <NeonButton
            variant="green"
            onClick={handleJoin}
            loading={loading}
            disabled={code.length < 6}
            className="flex-1"
          >
            {t('join')}
          </NeonButton>
        </div>
      </GlassCard>
    </div>
  );
}
