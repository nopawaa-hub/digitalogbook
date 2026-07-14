import { motion } from 'framer-motion'
import { PenLine } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import { VisitorCounter } from '@/components/ui/VisitorCounter'
import { sound } from '@/lib/sound'

interface WelcomeScreenProps {
  /** Running total of visitors so far (shown as a quiet pill). 0 hides it. */
  totalVisitors: number
  /** True while the visitor number is being reserved on tap. */
  reserving: boolean
  onStart: () => void
}

/**
 * Full-screen welcome / attract screen.
 *
 * Always in "attract mode": the logo breathes, "Start Signing" softly blinks,
 * particles drift, the gradient slowly shifts, and the visitor counter stays
 * visible. Tapping "Start Signing" reserves a visitor number and transitions
 * to the form.
 */
export function WelcomeScreen({ totalVisitors, reserving, onStart }: WelcomeScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="flex min-h-dvh w-full items-center justify-center px-6 py-10"
    >
      <GlassCard
        elevated
        glow
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl px-8 py-12 text-center sm:px-12 sm:py-16"
      >
        {/* Breathing logo mark */}
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient shadow-glow"
        >
          <PenLine className="h-10 w-10 text-white" strokeWidth={1.5} />
        </motion.div>

        {/* Cursive title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8 }}
          className="font-cursive text-6xl leading-tight text-brand-700 sm:text-7xl"
        >
          Visitor Log Book
        </motion.h1>

        {/* Subtitle — "Welcome to" in gold, the brand name in purple */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          className="mt-4 text-xl font-semibold sm:text-2xl"
        >
          <span className="text-gold-500">Welcome to </span>
          <span className="text-brand-600">ESLessonCraftMY</span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600"
        >
          Thank you for visiting our innovation booth.
          <br />
          We truly appreciate your time and feedback.
        </motion.p>

        {/* Visitor counter (attract mode keeps it visible) */}
        {totalVisitors > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="mt-8 flex justify-center"
          >
            <VisitorCounter value={totalVisitors} variant="pill" />
          </motion.div>
        )}

        {/* Start button — softly blinking glow + floating */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GlowButton
              onClick={onStart}
              loading={reserving}
              className="px-12 py-5 text-lg"
            >
              {reserving ? 'Preparing…' : 'Start Signing'}
            </GlowButton>
          </motion.div>
          {!reserving && (
            <motion.span
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-xs uppercase tracking-[0.2em] text-electric-500"
            >
              Tap to Begin
            </motion.span>
          )}
        </motion.div>
      </GlassCard>

      {/* Subtle footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute bottom-5 left-0 right-0 text-center text-xs text-brand-500"
      >
        {/* Sound state hint — sounds start muted for the exhibition booth */}
        {sound.isMuted ? '🔇 Sounds muted' : '🔊 Sounds on'}
      </motion.p>
    </motion.div>
  )
}
