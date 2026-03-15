import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useLangStore } from '../../stores/langStore';
import { GlassCard } from '../ui/GlassCard';

interface InviteCodeDisplayProps {
  code: string;
  groupName: string;
}

export function InviteCodeDisplay({ code, groupName }: InviteCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useUIStore();
  const { t } = useLangStore();

  const handleCopy = async () => {
    const shareText = `Join my GoalBet group "${groupName}"! Code: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'GoalBet Invite', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        addToast(t('copySuccess'), 'success');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <GlassCard className="p-4">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-3">{t('inviteCode')}</div>
      <button onClick={handleCopy} className="w-full flex items-center justify-between gap-3 group">
        <span className="font-bebas text-3xl tracking-widest text-accent-green text-glow-green">{code}</span>
        <span className="text-text-muted text-xs group-hover:text-white transition-colors">
          {copied ? t('copied') : t('copyAndShare')}
        </span>
      </button>
    </GlassCard>
  );
}
