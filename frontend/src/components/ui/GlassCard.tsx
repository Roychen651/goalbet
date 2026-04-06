import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
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
  /** Enables the dynamic cursor-tracking spotlight glare effect */
  interactive?: boolean;
}

export function GlassCard({
  children,
  className,
  variant = 'default',
  onClick,
  as: Tag = 'div',
  style,
  leagueAccent,
  interactive,
}: GlassCardProps) {
  // Always initialize motion values — hooks must be unconditional
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  // Precompute the radial gradient template — used only when interactive
  const glareBackground = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(189, 232, 245, 0.08), transparent 80%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

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
    // Needed for the absolute-positioned glare overlay to be contained
    (interactive || onClick) && 'relative overflow-hidden group',
    className,
  );

  const dynamicStyle: React.CSSProperties = leagueAccent
    ? { ...style, borderInlineStartColor: leagueAccent, borderInlineStartWidth: '3px' }
    : { ...style };

  // Use motion.div when interactive (spotlight glare) or clickable (scale animation)
  if (interactive || onClick) {
    return (
      <motion.div
        whileHover={onClick ? { scale: 1.003, y: -2 } : undefined}
        whileTap={onClick ? { scale: 0.997, y: 0 } : undefined}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        style={dynamicStyle}
        onClick={onClick}
        onMouseMove={interactive ? handleMouseMove : undefined}
        className={cn(base, onClick && 'cursor-pointer')}
      >
        {/* Dynamic cursor-tracking spotlight — pointer-events-none so it never blocks clicks */}
        {interactive && (
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: glareBackground }}
          />
        )}
        {/* z-10 keeps content above the glare overlay */}
        <div className={cn(interactive && 'relative z-10')}>
          {children}
        </div>
      </motion.div>
    );
  }

  return (
    <Tag className={base} style={dynamicStyle}>
      {children}
    </Tag>
  );
}
