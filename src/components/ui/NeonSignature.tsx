import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface NeonSignatureProps {
  src: string
  alt: string
  className?: string
  /** Fired if the image fails to load (so the parent can hide its column). */
  onError?: () => void
}

/**
 * Renders a visitor's signature as a neon glow that hugs the *ink strokes*.
 *
 * Single canvas approach (no separate blurred glow canvas — that caused a
 * rectangular border glow):
 *   1. Load the source PNG WITHOUT crossOrigin (Firebase Storage sends no
 *      CORS headers, so crossOrigin would abort the load).
 *   2. `drawImage` onto a canvas. The canvas taints but displays fine.
 *   3. `globalCompositeOperation: 'source-atop'` + fillRect → recolor ONLY
 *      the ink's alpha shape (white). Transparent areas stay transparent.
 *   4. CSS `filter: drop-shadow(...)` on the canvas — follows the ink's
 *      alpha shape (NOT the rectangle), so the glow hugs the strokes.
 */

const LINE_COLOR = '#FFFFFF' // signature line — pure white
const NEON = '#A855F7' // bright purple neon glow

export function NeonSignature({ src, alt, className, onError }: NeonSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      if (img.width === 0 || img.height === 0) {
        setFailed(true)
        onError?.()
        return
      }
      try {
        const maxDim = 700
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        canvas.width = w
        canvas.height = h

        // Draw the source PNG, then recolor ONLY the ink shape to white.
        ctx.clearRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(img, 0, 0, w, h)
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fillStyle = LINE_COLOR
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'

        setReady(true)
      } catch (err) {
        console.error('[NeonSignature] render failed:', err)
        setFailed(true)
        onError?.()
      }
    }
    img.onerror = () => {
      if (cancelled) return
      console.error('[NeonSignature] image load failed:', src)
      setFailed(true)
      onError?.()
    }
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src, onError])

  if (failed) return null

  // Drop-shadow follows the ink's alpha shape, NOT the canvas rectangle —
  // so the glow hugs the strokes and never glows the border.
  const glow = [
    `drop-shadow(0 0 2px rgba(255,255,255,0.95))`,
    `drop-shadow(0 0 5px ${NEON})`,
    `drop-shadow(0 0 10px ${NEON})`,
    `drop-shadow(0 0 20px rgba(168,85,247,0.85))`,
  ].join(' ')

  return (
    <motion.canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={className}
      style={{ filter: ready ? glow : 'none' }}
      animate={{ opacity: ready ? [0.85, 1, 0.85] : 0.4 }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}
