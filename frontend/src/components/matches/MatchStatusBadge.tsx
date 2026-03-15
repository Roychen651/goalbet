import { cn } from '../../lib/utils';
import { LIVE_STATUSES } from '../../lib/constants';
import { useLangStore } from '../../stores/langStore';

interface MatchStatusBadgeProps {
  status: string;
  className?: string;
}

export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const { t } = useLangStore();
  const isLive = LIVE_STATUSES.includes(status);

  const getLabel = () => {
    switch (status) {
      case 'NS': return t('upcoming_status');
      case '1H': case '2H': return t('live_status');
      case 'HT': return t('halfTime_status');
      case 'FT': return t('fullTime_status');
      case 'PST': return t('postponed_status');
      case 'CANC': return t('cancelled_status');
      default: return status;
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
        isLive && 'bg-accent-green/15 text-accent-green border border-accent-green/30',
        status === 'FT' && 'bg-white/8 text-text-muted border border-white/10',
        status === 'NS' && 'bg-white/5 text-text-muted border border-white/8',
        status === 'HT' && 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        (status === 'PST' || status === 'CANC') && 'bg-red-500/15 text-red-400 border border-red-500/30',
        className
      )}
    >
      {isLive && <span className="live-dot" />}
      {getLabel()}
    </span>
  );
}
