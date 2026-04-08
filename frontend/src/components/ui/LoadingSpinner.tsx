import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useLangStore } from '../../stores/langStore';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'inline-block rounded-full border-2 border-white/10 border-t-accent-green animate-spin',
        size === 'sm' && 'w-4 h-4',
        size === 'md' && 'w-8 h-8',
        size === 'lg' && 'w-12 h-12',
        className
      )}
    />
  );
}

export function PageLoader() {
  const { t } = useLangStore();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 7000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-bounce select-none">⚽</span>
        <p className="text-text-muted text-sm">
          {slow ? t('loadingSlow') : t('loadingMatches')}
        </p>
        {slow && (
          <p className="text-text-muted/50 text-xs max-w-[220px] text-center">
            Backend starts cold — usually ready in 10–20s
          </p>
        )}
      </div>
    </div>
  );
}

/** Skeleton placeholder shaped like a MatchCard row */
export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/2 p-4 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-32 rounded bg-white/8" />
        <div className="h-5 w-20 rounded-full bg-white/6" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div className="w-10 h-10 rounded-full bg-white/8" />
          <div className="h-3 w-16 rounded bg-white/6" />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="h-5 w-20 rounded bg-white/6" />
          <div className="h-3 w-12 rounded bg-white/5" />
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <div className="w-10 h-10 rounded-full bg-white/8" />
          <div className="h-3 w-16 rounded bg-white/6" />
        </div>
      </div>
    </div>
  );
}
