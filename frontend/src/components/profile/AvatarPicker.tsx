import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { Avatar } from '../ui/Avatar';
import { NeonButton } from '../ui/NeonButton';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

const EMOJI_AVATARS = [
  '⚽', '🏆', '🎯', '🔥', '⚡', '🌟',
  '🦁', '🐯', '🦊', '🐺', '🦅', '🐉',
  '👑', '🤖', '🦄', '🎮', '🏴‍☠️', '🧠',
  '🚀', '💎', '🎭', '🏋️', '🥊', '🎪',
];

interface AvatarPickerProps {
  onClose: () => void;
}

export function AvatarPicker({ onClose }: AvatarPickerProps) {
  const { profile, updateAvatar, user } = useAuthStore();
  const { addToast } = useUIStore();
  const { t } = useLangStore();
  const [selected, setSelected] = useState<string>(profile?.avatar_url ?? '');
  const [saving, setSaving] = useState(false);

  const googlePhoto = user?.user_metadata?.avatar_url ?? null;

  const handleSave = async () => {
    if (selected === profile?.avatar_url) { onClose(); return; }
    setSaving(true);
    try {
      await updateAvatar(selected);
      addToast(t('avatarSaved'), 'success');
      onClose();
    } catch {
      addToast('Failed to save avatar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <GlassCard variant="elevated" className="w-full max-w-sm p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-bebas text-xl tracking-wider text-white">{t('chooseAvatar')}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-white text-lg leading-none p-1">✕</button>
          </div>

          {/* Preview */}
          <div className="flex justify-center py-2">
            <motion.div
              key={selected}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Avatar
                src={selected || null}
                name={profile?.username ?? '?'}
                size="xl"
                className="ring-2 ring-accent-green/40 shadow-glow-green"
              />
            </motion.div>
          </div>

          {/* Google photo option */}
          {googlePhoto && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('googlePhoto')}</p>
              <button
                onClick={() => setSelected(googlePhoto)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border transition-all',
                  selected === googlePhoto
                    ? 'border-accent-green/50 bg-accent-green/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                )}
              >
                <img src={googlePhoto} alt="Google" className="w-9 h-9 rounded-full object-cover" />
                <span className="text-white text-sm">Use Google photo</span>
                {selected === googlePhoto && (
                  <span className="ms-auto text-accent-green text-sm">✓</span>
                )}
              </button>
            </div>
          )}

          {/* Emoji grid */}
          <div>
            <p className="text-text-muted text-xs uppercase tracking-wider mb-2">{t('chooseAvatar')}</p>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_AVATARS.map(emoji => {
                const value = `emoji:${emoji}`;
                const isSelected = selected === value;
                return (
                  <motion.button
                    key={emoji}
                    onClick={() => setSelected(value)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-xl border transition-all',
                      isSelected
                        ? 'border-accent-green bg-accent-green/15 shadow-glow-green-sm'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    {emoji}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <NeonButton variant="ghost" onClick={onClose} className="flex-1">{t('cancel')}</NeonButton>
            <NeonButton variant="green" onClick={handleSave} loading={saving} className="flex-1">
              {t('saveAvatar')}
            </NeonButton>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
