import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'elevated' | 'live' | 'live-predicted';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  as?: 'div' | 'article' | 'section';
  style?: React.CSSProperties;
  leagueAccent?: string;
}

export function GlassCard({ children, className, variant = 'default', onClick, as: Tag = 'div', style, leagueAccent }: GlassCardProps) {
  const base = cn(
    'rounded-2xl border backdrop-blur-glass transition-all duration-200',
    'card-base',
    variant === 'elevated' && ['card-elevated', 'shadow-[0_4px_24px_rgba(0,0,0,0.4)]'],
    variant === 'live' && [
      'border-accent-green/30 bg-[rgba(0,255,135,0.04)]',
      'shadow-[0_0_30px_rgba(0,255,135,0.08),inset_0_1px_0_rgba(0,255,135,0.08)]',
    ],
    variant === 'live-predicted' && [
      'border-blue-400/35 bg-[rgba(96,165,250,0.05)]',
      'shadow-[0_0_32px_rgba(96,165,250,0.12),inset_0_1px_0_rgba(96,165,250,0.10)]',
    ],
    onClick && 'cursor-pointer card-clickable',
    className
  );

  const dynamicStyle: React.CSSProperties = leagueAccent
    ? { ...style, borderInlineStartColor: leagueAccent, borderInlineStartWidth: '3px' }
    : { ...style };

  if (onClick) {
    return (
      <motion.div
        whileHover={{ scale: 1.003, y: -2 }}
        whileTap={{ scale: 0.997, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        style={dynamicStyle}
        onClick={onClick}
        className={cn(base, 'cursor-pointer')}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Tag className={base} style={dynamicStyle}>
      {children}
    </Tag>
  );
}
