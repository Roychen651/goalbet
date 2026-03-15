import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { NeonButton } from '../ui/NeonButton';
import { FOOTBALL_LEAGUES } from '../../lib/constants';
import { GlassCard } from '../ui/GlassCard';

interface CreateGroupModalProps {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([4328, 4335, 4346]);
  const [loading, setLoading] = useState(false);
  const { createGroup } = useGroupStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const { t } = useLangStore();

  const toggleLeague = (id: number) => {
    setSelectedLeagues(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const group = await createGroup(name.trim(), selectedLeagues);
      addToast(`"${group.name}" ${t('groupCreated')} ${group.invite_code}`, 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create group', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <GlassCard
        variant="elevated"
        className="w-full max-w-md p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="font-bebas text-2xl tracking-wider text-white">{t('createGroupTitle')}</h2>
          <p className="text-text-muted text-sm mt-1">{t('createGroupDesc')}</p>
        </div>

        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">{t('groupName')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('groupNamePlaceholder')}
            maxLength={40}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-accent-green transition-colors"
          />
        </div>

        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">
            {t('activeLeagues')} ({selectedLeagues.length} {t('selected')})
          </label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {FOOTBALL_LEAGUES.map(league => (
              <button
                key={league.id}
                onClick={() => toggleLeague(league.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedLeagues.includes(league.id)
                    ? 'bg-accent-green/15 border-accent-green text-accent-green'
                    : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10'
                }`}
              >
                {league.badge} {league.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <NeonButton variant="ghost" onClick={onClose} className="flex-1">{t('cancel')}</NeonButton>
          <NeonButton
            variant="green"
            onClick={handleCreate}
            loading={loading}
            disabled={!name.trim() || selectedLeagues.length === 0}
            className="flex-1"
          >
            {t('createGroup')}
          </NeonButton>
        </div>
      </GlassCard>
    </div>
  );
}
