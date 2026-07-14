import { forwardRef, useRef, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'

type GlowButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'ghost'
  loading?: boolean
  children?: ReactNode
}

/**
 * Premium primary button: purple gradient fill, gentle glow, subtle floating
 * idle animation, and a ripple that radiates from the tap point.
 */
export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  function GlowButton(
    { className, variant = 'primary', loading, children, onClick, disabled, ...props },
    ref,
  ) {
    const rippleHostRef = useRef<HTMLSpanElement>(null)

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      sound.play('click')
      // Spawn a ripple at the tap location.
      const host = rippleHostRef.current
      if (host) {
        const rect = host.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const ripple = document.createElement('span')
        ripple.style.position = 'absolute'
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`
        ripple.style.width = `${size}px`
        ripple.style.height = `${size}px`
        ripple.style.borderRadius = '9999px'
        ripple.style.background = 'rgba(255,255,255,0.45)'
        ripple.style.pointerEvents = 'none'
        ripple.style.transform = 'scale(0)'
        ripple.style.opacity = '0.6'
        ripple.style.animation = 'ripple 0.6s ease-out forwards'
        host.appendChild(ripple)
        window.setTimeout(() => ripple.remove(), 650)
      }
      onClick?.(e)
    }

    if (variant === 'ghost') {
      return (
        <motion.button
          ref={ref}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleClick}
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-center rounded-2xl border border-white/40 bg-white/40 px-6 py-3 font-medium text-brand-700 backdrop-blur-md transition-colors hover:bg-white/60 disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </motion.button>
      )
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.03, boxShadow: '0 0 50px -6px rgba(109,94,248,0.7)' }}
        animate={{ y: [0, -4, 0] }}
        transition={{
          y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
          scale: { type: 'spring', stiffness: 400, damping: 22 },
        }}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-brand-gradient px-8 py-4 text-base font-semibold text-white shadow-glow transition-shadow disabled:opacity-60',
          className,
        )}
        style={{ backgroundSize: '200% 200%' }}
        {...props}
      >
        {/* Ripple layer */}
        <span ref={rippleHostRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
        {/* Sheen */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
        <span className={cn('relative z-10 flex items-center gap-2', loading && 'opacity-0')}>
          {children}
        </span>
        {loading && (
          <span className="absolute inset-0 z-20 flex items-center justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        )}
      </motion.button>
    )
  },
)
