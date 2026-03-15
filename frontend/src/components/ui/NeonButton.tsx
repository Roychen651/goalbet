import { cn } from '../../lib/utils';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'green' | 'orange' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function NeonButton({
  variant = 'green',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: NeonButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-dm font-semibold rounded-xl',
        'transition-all duration-200 select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        // Sizes
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-5 py-2.5 text-sm',
        size === 'lg' && 'px-7 py-3.5 text-base',
        // Variants
        variant === 'green' && [
          'bg-accent-green text-bg-base',
          'hover:shadow-glow-green hover:scale-[1.02] active:scale-[0.98]',
        ],
        variant === 'orange' && [
          'bg-accent-orange text-white',
          'hover:shadow-glow-orange hover:scale-[1.02] active:scale-[0.98]',
        ],
        variant === 'ghost' && [
          'bg-transparent text-white border border-[rgba(255,255,255,0.15)]',
          'hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.25)] active:scale-[0.98]',
        ],
        variant === 'danger' && [
          'bg-red-500/20 text-red-400 border border-red-500/30',
          'hover:bg-red-500/30 active:scale-[0.98]',
        ],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          <span className="opacity-70">{children}</span>
        </>
      ) : children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="20" />
    </svg>
  );
}
