import { getInitials, cn } from '../../lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

const emojiFontSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  // Emoji avatar stored as "emoji:⚽"
  if (src?.startsWith('emoji:')) {
    const emoji = src.slice(6);
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center',
          'bg-gradient-to-br from-white/10 to-white/5 border border-white/15',
          'ring-1 ring-white/10',
          sizes[size],
          className
        )}
      >
        <span className={emojiFontSizes[size]}>{emoji}</span>
      </div>
    );
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover ring-1 ring-white/10', sizes[size], className)}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bebas tracking-wider',
        'bg-gradient-to-br from-accent-green/20 to-accent-orange/20 border border-white/10',
        'text-white ring-1 ring-white/10',
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
