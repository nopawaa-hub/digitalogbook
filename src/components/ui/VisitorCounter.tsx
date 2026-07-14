import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Users } from 'lucide-react'
import { fmtNumber } from '@/lib/utils'

interface VisitorCounterProps {
  /** The target number to display. When it changes, it animates upward. */
  value: number
  /** Variant: the celebratory form banner vs. the quiet welcome pill. */
  variant?: 'banner' | 'pill'
}

/**
 * Animated visitor counter.
 *
 * When `value` rises, the displayed number counts up rapidly (ease-out), and
 * a brief sparkle bursts next to the number — the "subtle sparkle animation
 * whenever the number increases" from the spec.
 */
export function VisitorCounter({ value, variant = 'banner' }: VisitorCounterProps) {
  const [display, setDisplay] = useState(value)
  const [sparkleKey, setSparkleKey] = useState(0)
  const prevValue = useRef(value)

  useEffect(() => {
    const startFrom = prevValue.current
    if (value === startFrom) return
    prevValue.current = value
    setSparkleKey((k) => k + 1)

    const from = display
    const to = value
    const duration = 900
    const start = performance.now()
    let raf = 0
    const step = (ts: number) => {
      const t = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (variant === 'pill') {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/50 px-4 py-1.5 text-sm font-medium text-brand-700 backdrop-blur-md">
        <Users className="h-4 w-4" />
        <span>{fmtNumber(display)} visitors</span>
      </div>
    )
  }

  return (
    <div className="relative inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-white/60 px-5 py-2 text-base font-semibold text-brand-700 shadow-glass backdrop-blur-md sm:text-lg">
      <motion.div
        key={sparkleKey || 'idle'}
        initial={sparkleKey ? { scale: 1 } : false}
        animate={sparkleKey ? { scale: [1, 1.3, 1] } : undefined}
        transition={{ duration: 0.5 }}
      >
        <Users className="h-5 w-5 text-brand-500" />
      </motion.div>
      <span className="text-brand-900">Visitor</span>
      <span className="relative tabular-nums text-brand-600">
        #{fmtNumber(display)}
        <AnimatePresence>
          {sparkleKey > 0 && (
            <motion.span
              key={sparkleKey}
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 0.8], y: [-2, -16] }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="pointer-events-none absolute -right-2 -top-2 text-amber-400"
            >
              <Sparkles className="h-4 w-4 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  )
}
