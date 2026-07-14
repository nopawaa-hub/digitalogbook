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
 * Renders a visitor's signature with a neon glow that hugs the *ink strokes*.
 *
 * Two canvases stacked:
 *
 *   1. Ink canvas (top):
 *      - drawImage the source PNG (no crossOrigin — Firebase Storage sends no
 *        CORS headers, so crossOrigin would abort the load; drawing still works
 *        and displays even though the canvas taints, since we never read pixels).
 *      - Then `globalCompositeOperation: 'source-atop'` + fillRect with LINE_COLOR
 *        recolors ONLY the ink's alpha shape to #F4CEFF. Transparent areas stay
 *        transparent. (source-atop only affects existing non-transparent pixels.)
 *
 *   2. Neon-glow canvas (bottom):
 *      - Same ink shape, filled solid with NEON_COLOR (#8140DC), then CSS-blurred
 *        via `filter: blur(...)` so it blooms out from the strokes. At ~70% alpha.
 *
 * Drop-shadow / blur on the separate canvases means the glow hugs the line and
 * the ink stays crisp and the right color, regardless of the card background.
 */

// Exact requested colors.
const LINE_COLOR = '#FFFFFF' // signature line — pure white
const NEON_COLOR = '#A855F7' // neon glow — bright vivid purple

export function NeonSignature({ src, alt, className, onError }: NeonSignatureProps) {
  const inkCanvasRef = useRef<HTMLCanvasElement>(null)
  const glowCanvasRef = useRef<HTMLCanvasElement>(null)
  const glowCanvasRef2 = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const inkCanvas = inkCanvasRef.current
    const glowCanvas = glowCanvasRef.current
    const glowCanvas2 = glowCanvasRef2.current
    if (!inkCanvas || !glowCanvas || !glowCanvas2) return
    const inkCtx = inkCanvas.getContext('2d')
    const glowCtx = glowCanvas.getContext('2d')
    const glowCtx2 = glowCanvas2.getContext('2d')
    if (!inkCtx || !glowCtx || !glowCtx2) return

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

        // Paint the neon ink shape onto BOTH glow canvases (tight + wide blur
        // applied via CSS filter on each element for a layered bloom).
        const paintNeonShape = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
          canvas.width = w
          canvas.height = h
          ctx.clearRect(0, 0, w, h)
          ctx.globalCompositeOperation = 'source-over'
          ctx.drawImage(img, 0, 0, w, h)
          // Tint the ink to the neon color (source-atop preserves alpha).
          ctx.globalCompositeOperation = 'source-atop'
          ctx.fillStyle = NEON_COLOR
          ctx.fillRect(0, 0, w, h)
          ctx.globalCompositeOperation = 'source-over'
        }

        for (const c of [inkCanvas, glowCanvas, glowCanvas2]) {
          c.width = w
          c.height = h
        }

        // ── Ink canvas: recolor only the ink shape to LINE_COLOR (white) ──
        inkCtx.clearRect(0, 0, w, h)
        inkCtx.globalCompositeOperation = 'source-over'
        inkCtx.drawImage(img, 0, 0, w, h)
        inkCtx.globalCompositeOperation = 'source-atop'
        inkCtx.fillStyle = LINE_COLOR
        inkCtx.fillRect(0, 0, w, h)
        inkCtx.globalCompositeOperation = 'source-over'

        // ── Glow canvases (tight + wide): neon dark-purple ink shape ──
        // Stack the neon fill several times per canvas → accumulate alpha so
        // the blurred bloom reads far more intense, not just blurrier.
        for (let i = 0; i < 5; i++) {
          paintNeonShape(glowCanvas, glowCtx)
          paintNeonShape(glowCanvas2, glowCtx2)
        }

        setReady(true)
      } catch (err) {
        console.error('[NeonSignature] canvas ops failed:', err)
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

  return (
    <div className={className} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Glow layer (bottom) — tight radius, high intensity, pulsing.
          Blur radii dialed back; intensity boosted via many stacked passes. */}
      <motion.div
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        animate={{ opacity: ready ? [0.95, 1, 0.95] : 0 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Tight glow pass */}
        <canvas
          ref={glowCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            filter: 'blur(6px) brightness(1.6)',
          }}
        />
        {/* Wider but still-restrained glow pass */}
        <canvas
          ref={glowCanvasRef2}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            filter: 'blur(14px) brightness(1.4)',
          }}
        />
      </motion.div>
      {/* Ink layer (top) — crisp #F4CEFF line */}
      <canvas
        ref={inkCanvasRef}
        role="img"
        aria-label={alt}
        style={{ position: 'relative', display: 'block' }}
      />
    </div>
  )
}
