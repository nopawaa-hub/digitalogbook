import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { VisitorCounter } from '@/components/ui/VisitorCounter'
import { GlowButton } from '@/components/ui/GlowButton'
import { SignatureReplay } from '@/components/ink/SignatureReplay'
import type { SerializedStrokes } from '@/components/ink/StrokeEngine'
import { sound } from '@/lib/sound'
import { cappedDPR } from '@/lib/utils'

interface SuccessCelebrationProps {
  visitorNumber: number
  /** Captured signature strokes for the replay animation. Null for old entries. */
  signatureStrokes?: SerializedStrokes | null
  /** Fallback image URL (unused for new entries, reserved for future). */
  signatureImageUrl?: string
  onDone: () => void
}

/**
 * Submission celebration sequence:
 *   1. (button morph→loading already happened on the form before we got here)
 *   2. Glowing checkmark draws itself on
 *   3. Purple sparkles expand outward from the checkmark
 *   4. Visitor number briefly enlarges with a soft glow
 *   5. Thank-you copy reveals
 *
 * The 10s idle return-to-welcome is handled by the App's idle timer, but we
 * also offer a "Next Visitor" button to skip the wait.
 */
export function SuccessCelebration({
  visitorNumber,
  signatureStrokes,
  onDone,
}: SuccessCelebrationProps) {
  const [burst, setBurst] = useState(false)
  const [numberGlow, setNumberGlow] = useState(false)
  const chimePlayed = useRef(false)

  useEffect(() => {
    // Stagger the sequence.
    const t1 = window.setTimeout(() => setBurst(true), 700)
    const t2 = window.setTimeout(() => setNumberGlow(true), 1100)
    if (!chimePlayed.current) {
      chimePlayed.current = true
      sound.play('chime')
    }
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.6 }}
      className="relative flex min-h-dvh w-full items-center justify-center px-6 py-10"
    >
      {/*
        Signature replay: re-draws the visitor's own signature across the full
        screen following their original velocity curve with a neon pen tip,
        then fades out to reveal the thank-you content below. Falls back to the
        checkmark sequence when no strokes were captured (older submissions).
      */}
      <SignatureReplay strokes={signatureStrokes ?? null} />

      {/* Purple sparkle burst layer */}
      {burst && <SparkleBurst />}

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Glowing checkmark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.25 }}
          className="relative mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-brand-gradient shadow-glow-lg"
        >
          {/* Pulsing glow ring */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0.6 }}
            animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-brand-400/40"
          />
          <svg viewBox="0 0 52 52" className="h-14 w-14">
            <motion.path
              fill="none"
              stroke="white"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27 L22 35 L40 16"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))' }}
            />
          </svg>
        </motion.div>

        {/* Visitor number briefly enlarges with glow */}
        <motion.div
          animate={
            numberGlow
              ? { scale: [1, 1.18, 1], filter: ['drop-shadow(0 0 0px rgba(109,94,248,0))', 'drop-shadow(0 0 24px rgba(109,94,248,0.8))', 'drop-shadow(0 0 0px rgba(109,94,248,0))'] }
              : {}
          }
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="mb-8"
        >
          <VisitorCounter value={visitorNumber} variant="banner" />
        </motion.div>

        {/* Thank-you copy */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7 }}
          className="font-cursive text-5xl text-brand-700 sm:text-6xl"
        >
          Thank you
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.7 }}
          className="mt-3 text-xl font-semibold text-brand-600 sm:text-2xl"
        >
          for visiting ESLessonCraftMY
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.35, duration: 0.7 }}
          className="mt-2 text-base text-slate-600"
        >
          We appreciate your valuable feedback.
        </motion.p>

        {/* Soft returning hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0] }}
          transition={{ delay: 2.5, duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-8 text-xs uppercase tracking-[0.2em] text-brand-400"
        >
          Returning to welcome screen…
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="mt-6"
        >
          <GlowButton variant="ghost" onClick={onDone} className="border-electric-300 text-electric-600 px-8 py-3">
            Next Visitor
          </GlowButton>
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * Expanding ring of purple sparkles, drawn on a short-lived canvas.
 * Lasts ~1.2s then unmounts.
 */
function SparkleBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = cappedDPR(2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cx = w / 2
    const cy = h / 2 - 40 // align roughly with the checkmark
    const count = 28
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const speed = 180 + Math.random() * 220
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 2 + Math.random() * 3,
        // Mostly purple sparks, with occasional gold + electric blue for richness.
        hue: (() => {
          const r = Math.random()
          if (r < 0.7) return 255 + Math.random() * 35 // purple
          if (r < 0.88) return 45 + Math.random() * 15 // gold
          return 210 + Math.random() * 15 // electric blue
        })(),
      }
    })

    let raf = 0
    const start = performance.now()
    const tick = (ts: number) => {
      const elapsed = (ts - start) / 1000
      ctx.clearRect(0, 0, w, h)
      let alive = false
      for (const p of particles) {
        if (p.life <= 0) continue
        p.life = Math.max(0, 1 - elapsed / 1.1)
        if (p.life <= 0) continue
        alive = true
        p.x += p.vx * 0.016
        p.y += p.vy * 0.016
        p.vx *= 0.97
        p.vy *= 0.97
        const a = p.life * 0.9
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4)
        grad.addColorStop(0, `hsla(${p.hue},100%,85%,${a})`)
        grad.addColorStop(0.5, `hsla(${p.hue},100%,70%,${a * 0.4})`)
        grad.addColorStop(1, `hsla(${p.hue},100%,70%,0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      if (alive) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  )
}
