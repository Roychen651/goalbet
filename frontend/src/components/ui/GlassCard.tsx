import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'elevated' | 'live';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  as?: 'div' | 'article' | 'section';
}

export function GlassCard({ children, className, variant = 'default', onClick, as: Tag = 'div' }: GlassCardProps) {
  const base = cn(
    'rounded-2xl border backdrop-blur-glass transition-all duration-200',
    'card-base',
    variant === 'elevated' && ['card-elevated', 'shadow-[0_4px_24px_rgba(0,0,0,0.4)]'],
    variant === 'live' && [
      'border-accent-green/30 bg-[rgba(0,255,135,0.04)]',
      'shadow-[0_0_30px_rgba(0,255,135,0.08),inset_0_1px_0_rgba(0,255,135,0.08)]',
    ],
    onClick && 'cursor-pointer card-clickable',
    className
  );

  if (onClick) {
    return (
      <motion.div
        whileHover={{ scale: 1.005, y: -2, rotateX: 0.8, rotateY: 0.4 }}
        whileTap={{ scale: 0.995, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
        onClick={onClick}
        className={cn(base, 'cursor-pointer')}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Tag className={base}>
      {children}
    </Tag>
  );
}
