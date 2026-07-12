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
