import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'

interface StarRatingProps {
  value?: number
  onChange?: (value: number) => void
  className?: string
}

/**
 * Five animated stars. Optional — a value of 0 (or undefined) means "no
 * rating". Hovering previews the selection with a spring pop.
 */
export function StarRating({ value = 0, onChange, className }: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const active = hover || value

  return (
    <div className={cn('flex items-center gap-1.5', className)} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= active
        return (
          <motion.button
            key={star}
            type="button"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.18, rotate: filled ? 8 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            onMouseEnter={() => setHover(star)}
            onClick={() => {
              sound.play('click')
              // Clicking the active star again clears it.
              onChange?.(value === star ? 0 : star)
            }}
            className="p-0.5"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                filled
                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'fill-transparent text-brand-300/60',
              )}
              strokeWidth={1.5}
            />
          </motion.button>
        )
      })}
    </div>
  )
}
