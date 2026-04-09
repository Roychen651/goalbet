import { cn } from '../../lib/utils';
import { LIVE_STATUSES } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';

interface MatchStatusBadgeProps {
  status: string;
  className?: string;
  isSyncing?: boolean;
}

export function MatchStatusBadge({ status, className, isSyncing }: MatchStatusBadgeProps) {
  const { t } = useLangStore();
  // When backend is waking up, show a neutral "Syncing…" badge instead of alarming "Delayed"
  const effectiveStatus = isSyncing && status === 'DELAYED' ? 'SYNCING' : status;
  const isLive = LIVE_STATUSES.includes(effectiveStatus);
  const isETLive = effectiveStatus === 'ET1' || effectiveStatus === 'ET2';
  // 'ET_HT' is a sentinel passed by MatchCard for the live break between ET halves
  const isETHalf = effectiveStatus === 'ET_HT';

  const getLabel = () => {
    switch (effectiveStatus) {
      case 'SYNCING': return t('syncingLive_status');
      case 'DELAYED': return t('delayed_status');
      case 'NS': return t('upcoming_status');
      case '1H': case '2H': return t('live_status');
      case 'HT': return t('halfTime_status');
      case 'FT': return t('fullTime_status');
      case 'ET1': return t('etLive_status');
      case 'ET2': return t('etLive_status');
      case 'AET': return t('aet_status');
      case 'ET_HT': return t('aetHT_status');
      case 'PEN': return t('pens_status');
      case 'PST': return t('postponed_status');
      case 'CANC': return t('cancelled_status');
      default: return effectiveStatus;
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
        isLive && !isETLive && 'bg-accent-green/15 text-accent-green border border-accent-green/30',
        isETLive && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        isETHalf && 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20',
        effectiveStatus === 'AET' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        effectiveStatus === 'FT' && 'bg-white/8 text-text-muted border border-white/10',
        effectiveStatus === 'NS' && 'bg-white/5 text-text-muted border border-white/8',
        effectiveStatus === 'HT' && 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        effectiveStatus === 'PEN' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        effectiveStatus === 'DELAYED' && 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
        effectiveStatus === 'SYNCING' && 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
        (effectiveStatus === 'PST' || effectiveStatus === 'CANC') && 'bg-red-500/15 text-red-400 border border-red-500/30',
        className
      )}
    >
      {isLive && !isETLive && <span className="live-dot" />}
      {isETLive && <span className="live-dot-amber" />}
      {getLabel()}
    </span>
  );
}
