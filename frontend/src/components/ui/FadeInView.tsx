import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInViewProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'left' | 'right' | 'none';
  distance?: number;
}

export function FadeInView({
  children,
  delay = 0,
  className,
  direction = 'up',
  distance = 28,
}: FadeInViewProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: direction === 'up' ? distance : 0,
        x: direction === 'left' ? -distance : direction === 'right' ? distance : 0,
        scale: 0.97,
      }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        type: 'spring',
        stiffness: 90,
        damping: 20,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
