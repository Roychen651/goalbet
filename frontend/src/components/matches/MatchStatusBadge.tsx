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
  const isETLive = status === 'ET1' || status === 'ET2';
  // 'ET_HT' is a sentinel passed by MatchCard for the live break between ET halves
  const isETHalf = status === 'ET_HT';

  const getLabel = () => {
    switch (status) {
      case 'NS': return t('upcoming_status');
      case '1H': case '2H': return t('live_status');
      case 'HT': return t('halfTime_status');
      case 'FT': return t('fullTime_status');
      case 'ET1': return 'ET LIVE';
      case 'ET2': return 'ET LIVE';
      case 'AET': return 'AET';      // finished after extra time (no pens)
      case 'ET_HT': return 'AET HT'; // live: break between ET halves
      case 'PEN': return 'PENS';
      case 'PST': return t('postponed_status');
      case 'CANC': return t('cancelled_status');
      default: return status;
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
        isLive && !isETLive && 'bg-accent-green/15 text-accent-green border border-accent-green/30',
        isETLive && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        isETHalf && 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20',
        status === 'AET' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        status === 'FT' && 'bg-white/8 text-text-muted border border-white/10',
        status === 'NS' && 'bg-white/5 text-text-muted border border-white/8',
        status === 'HT' && 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        status === 'PEN' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        (status === 'PST' || status === 'CANC') && 'bg-red-500/15 text-red-400 border border-red-500/30',
        className
      )}
    >
      {isLive && !isETLive && <span className="live-dot" />}
      {isETLive && <span className="live-dot-amber" />}
      {getLabel()}
    </span>
  );
}
