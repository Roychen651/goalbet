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
        'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)]',
        // Variant styles
        variant === 'elevated' && [
          'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)]',
          'shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
        ],
        variant === 'live' && [
          'border-accent-green/30 bg-[rgba(0,255,135,0.04)]',
          'shadow-[0_0_20px_rgba(0,255,135,0.1)] animate-pulse-glow',
        ],
        // Clickable styles
        onClick && 'cursor-pointer hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {children}
    </Tag>
  );
}
