// V5 Sprint 36 Hotfix — "Challenge a Group" entry point for challenge_group()
// (migration 056, already live since Commit 3 but had no UI until now).
// Reuses CreateGroupModal.tsx/JoinGroupModal.tsx's exact shell pattern
// verbatim: a plain (non-animated) backdrop div carrying both the color and
// the blur, a GlassCard `variant="elevated"` panel, NeonButton footer. This
// is already WebKit-safe by construction (neither element is transformed,
// so the backdrop-filter+transform paint-failure class of bug — §21/§34/§38
// — structurally can't occur) — no reason to invent a new shell for this.

import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { supabase } from '../../lib/supabase';
import { NeonButton } from '../ui/NeonButton';
import { GlassCard } from '../ui/GlassCard';
import { haptic } from '../../lib/haptics';
import { playSound } from '../../lib/sensoryAudio';
import { cn } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

interface ChallengeGroupModalProps {
  onClose: () => void;
}

type DurationPreset = 'weekend' | 'week';

// Explicit, stated definitions — "weekend" is inherently a bit fuzzy, so
// the exact interval is spelled out here rather than left implicit.
const DURATION_DAYS: Record<DurationPreset, number> = {
  weekend: 3,
  week: 7,
};

const ERROR_KEY: Record<string, TranslationKey> = {
  invalid_window: 'battleErrorInvalidWindow',
  group_not_found: 'battleErrorGroupNotFound',
  cannot_challenge_self: 'battleErrorSelfChallenge',
};

export function ChallengeGroupModal({ onClose }: ChallengeGroupModalProps) {
  const { activeGroupId, groups } = useGroupStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const { t } = useLangStore();

  const [inviteCode, setInviteCode] = useState('');
  const [duration, setDuration] = useState<DurationPreset>('weekend');
  const [loading, setLoading] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  // Client-side nicety only — a friendly early block before even calling
  // the RPC. challenge_group()'s own cannot_challenge_self check (migration
  // 056) remains the real, authoritative guard; this never substitutes for it.
  const isSelfChallenge = !!activeGroup && inviteCode.trim().toUpperCase() === activeGroup.invite_code.toUpperCase();

  const handleChallenge = async () => {
    if (!activeGroupId || !user || !inviteCode.trim() || isSelfChallenge || loading) return;
    setLoading(true);
    haptic('selection');
    playSound('toggle_click');
    try {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + DURATION_DAYS[duration] * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase.rpc('challenge_group', {
        p_challenger_group_id: activeGroupId,
        p_defender_invite_code: inviteCode.trim().toUpperCase(),
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
      });
      if (error) throw error;
      const result = data as { success: boolean; battle_id?: string; error?: string };
      if (!result.success) {
        addToast(t(ERROR_KEY[result.error ?? ''] ?? 'battleErrorGeneric'), 'error');
        return;
      }
      haptic('success');
      playSound('lock_thud');
      addToast(t('battleChallengeSent'), 'success');
      onClose();
    } catch {
      addToast(t('battleErrorGeneric'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <GlassCard
        variant="elevated"
        className="w-full max-w-md p-6"
        contentClassName="space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-bebas text-2xl tracking-wider text-white">{t('challengeGroupTitle')}</h2>
          <p className="text-text-muted text-sm mt-1">{t('challengeGroupDesc')}</p>
        </div>

        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">{t('rivalInviteCode')}</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder={t('rivalInviteCodePlaceholder')}
            maxLength={12}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono placeholder:text-white/30 placeholder:font-sans focus:outline-none focus:border-accent-green transition-colors"
          />
          {isSelfChallenge && (
            <p className="text-red-400 text-[11px] mt-1.5">{t('battleErrorSelfChallenge')}</p>
          )}
        </div>

        <div>
          <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">{t('battleDuration')}</label>
          <div className="flex gap-2">
            {(['weekend', 'week'] as DurationPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDuration(preset)}
                className={cn(
                  'flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                  duration === preset
                    ? 'bg-accent-green/15 border-accent-green text-accent-green'
                    : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10',
                )}
              >
                {preset === 'weekend' ? t('battleDurationWeekend') : t('battleDurationWeek')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <NeonButton variant="ghost" onClick={onClose} className="flex-1">{t('cancel')}</NeonButton>
          <NeonButton
            variant="green"
            onClick={handleChallenge}
            loading={loading}
            disabled={!inviteCode.trim() || isSelfChallenge}
            className="flex-1"
          >
            {t('sendChallenge')}
          </NeonButton>
        </div>
      </GlassCard>
    </div>
  );
}
