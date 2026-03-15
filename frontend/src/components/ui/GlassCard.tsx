import { cn } from '../../lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'live';
  onClick?: React.MouseEventHandler;
  as?: 'div' | 'article' | 'section';
}

export function GlassCard({
  children,
  className,
  variant = 'default',
  onClick,
  as: Tag = 'div',
}: GlassCardProps) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'rounded-2xl border backdrop-blur-glass transition-all duration-200',
        'card-base',
        // Variant styles
        variant === 'elevated' && [
          'card-elevated',
          'shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
        ],
        variant === 'live' && [
          'border-accent-green/30 bg-[rgba(0,255,135,0.04)]',
          'shadow-[0_0_20px_rgba(0,255,135,0.1)] animate-pulse-glow',
        ],
        // Clickable styles
        onClick && 'cursor-pointer card-clickable',
        className
      )}
    >
      {children}
    </Tag>
  );
}
