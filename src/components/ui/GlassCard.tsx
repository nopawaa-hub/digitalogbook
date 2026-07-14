import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

type GlassCardProps = HTMLMotionProps<'div'> & {
  /** Adds an accent glow halo around the card. */
  glow?: boolean
  /** Slightly stronger glass + larger shadow. */
  elevated?: boolean
}

/**
 * Glassmorphism card — the primary surface for content throughout the app.
 * Frosted blur, translucent white fill, hairline border, soft shadow, and a
 * subtle gradient sheen for depth. 24px radius (rounded-4xl) by default.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard({ className, glow, elevated, children, ...props }, ref) {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-4xl border border-white/40 bg-white/55 backdrop-blur-xl',
          elevated ? 'shadow-glass-lg' : 'shadow-glass',
          glow && 'shadow-glow',
          // Subtle top sheen for depth.
          'before:pointer-events-none before:absolute before:inset-0 before:rounded-4xl',
          'before:bg-gradient-to-b before:from-white/40 before:to-transparent before:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </motion.div>
    )
  },
)
