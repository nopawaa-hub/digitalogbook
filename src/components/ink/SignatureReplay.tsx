import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { SerializedStrokes, SerializedPoint } from './StrokeEngine'

interface SignatureReplayProps {
  /** The visitor's captured strokes. If null/empty, the parent should fall back
   *  to the static checkmark + visitor number. */
  strokes: SerializedStrokes | null
  /**
   * Constrains the replay to a horizontal fraction of the viewport (used when
   * multiple replays play simultaneously, e.g. 3 judge signatures side by side).
   * `widthFraction` = how much of the viewport width to use (default 1 = full).
   * `offsetFraction` = horizontal offset from the left (default 0).
   */
  region?: { widthFraction: number; offsetFraction: number }
  /**
   * When true, renders as an inline element (position: relative) that fits inside
   * a parent container (e.g. a certificate card) instead of a fixed full-screen
   * overlay. The canvas sizes itself to the parent's dimensions.
   */
  contained?: boolean
  /** Optional className for the wrapper (useful in contained mode). */
  className?: string
}

/**
 * Signature replay — the interactive "wow" moment at submit.
 *
 * Re-draws the visitor's own signature across the FULL SCREEN, following the
 * original pen path with its real velocity curve (restored from each point's
 * timestamp), with a neon-glow trailing pen tip. Once drawing completes, the
 * whole thing shrinks and fades down to its final size while the rest of the
 * celebration UI fades in.
 *
 * Technique:
 *   - We build a flat list of "steps": segments along each stroke, sampled so
 *     that the temporal spacing in the replay matches how the visitor actually
 *     signed (curve velocity). Each step carries the original timestamp delta.
 *   - A rAF loop advances through steps in real time: drawing quadratic-Bézier
 *     smoothed segments (through midpoints, same as StrokeEngine) onto an ink
 *     canvas, while a second "glow" canvas shows a pulsing dot + sparkles at
 *     the current pen tip.
 *   - On finish, a framer-motion wrapper animates scale (1 → ~0.28) and fades,
 *     moving the signature into its resting position near the top of the card.
 */
const REPLAY_SPEED = 1.0 // 1x real-time; raise for faster playback
const INK_COLOR = '#FFFFFF' // bright white ink — visible on the dark celebration bg

interface Step {
  stroke: number
  // segment endpoints (canvas px)
  x1: number
  y1: number
  x2: number
  y2: number
  // bézier control point
  cx: number
  cy: number
  // accumulated time (ms) from start of replay at which to draw this segment
  t: number
  baseWidth: number
  pressure: number
}

export function SignatureReplay({ strokes, region, contained = false, className }: SignatureReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLCanvasElement>(null)
  const [replayDone, setReplayDone] = useState(false)

  const hasStrokes =
    !!strokes && strokes.strokes.length > 0 && strokes.width > 0

  useEffect(() => {
    if (!hasStrokes || !strokes) return
    const ink = canvasRef.current
    const glow = glowRef.current
    if (!ink || !glow) return
    const ictx = ink.getContext('2d')
    const gctx = glow.getContext('2d')
    if (!ictx || !gctx) return

    // ── Build the replay steps from the strokes ──────────────────────
    // We sample each stroke into bézier segments (midpoint smoothing, same
    // algorithm as StrokeEngine), carrying the ORIGINAL timestamp deltas so the
    // replay follows the visitor's real curve velocity. We also remap the
    // stroke coords from the source canvas size to the replay region size.
    const srcW = strokes.width
    const srcH = strokes.height
    // In contained mode, size to the parent element; otherwise to the viewport.
    const parent = contained ? ink.parentElement : null
    const fullVw = contained
      ? parent?.clientWidth || 280
      : window.innerWidth
    const fullVh = contained
      ? parent?.clientHeight || 120
      : window.innerHeight
    const vw = region ? fullVw * region.widthFraction : fullVw
    const vh = fullVh
    const regionOffsetX = region ? fullVw * region.offsetFraction : 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ink.width = vw * dpr
    ink.height = vh * dpr
    ink.style.width = `${vw}px`
    ink.style.height = `${vh}px`
    glow.width = vw * dpr
    glow.height = vh * dpr
    glow.style.width = `${vw}px`
    glow.style.height = `${vh}px`
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0)
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Fit scale: signature centered and sized to ~85% of the smaller dimension.
    const fit = Math.min(vw / srcW, vh / srcH) * 0.85
    const offX = (vw - srcW * fit) / 2
    const offY = (vh - srcH * fit) / 2
    const tx = (x: number) => regionOffsetX + offX + x * fit
    const ty = (y: number) => offY + y * fit

    const steps: Step[] = []
    let elapsed = 0
    strokes.strokes.forEach((stroke, si) => {
      const pts = stroke.points
      if (pts.length < 2) return
      // Use the first point's timestamp as the stroke's start; compute deltas.
      const t0 = pts[0].t
      const mid = (a: SerializedPoint, b: SerializedPoint) => ({
        x: tx((a.x + b.x) / 2),
        y: ty((a.y + b.y) / 2),
      })
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const from = i >= 2 ? mid(pts[i - 2], a) : { x: tx(a.x), y: ty(a.y) }
        const to = mid(a, b)
        const cp = { x: tx(a.x), y: ty(a.y) }
        elapsed += (b.t - (i === 1 ? t0 : pts[i - 1].t)) / REPLAY_SPEED
        steps.push({
          stroke: si,
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          cx: cp.x,
          cy: cp.y,
          t: Math.max(0, elapsed),
          baseWidth: stroke.baseWidth * fit * 1.2,
          pressure: (a.p + b.p) / 2,
        })
      }
    })

    if (steps.length === 0) return

    // ── rAF replay loop ──────────────────────────────────────────────
    ictx.lineCap = 'round'
    ictx.lineJoin = 'round'
    ictx.strokeStyle = INK_COLOR
    // Neon glow on the ink canvas itself — bright white core with purple bloom.
    // shadowBlur gives each stroke a neon halo that follows the line.
    ictx.shadowColor = '#A855F7'
    ictx.shadowBlur = 16
    gctx.lineCap = 'round'

    let raf = 0
    let running = true
    const startTs = performance.now()
    let nextStep = 0
    let pen: { x: number; y: number } | null = null
    let penVisible = false
    let penAlpha = 0
    const sparkles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      life: number
      max: number
      size: number
    }> = []
    let lastSpawn = 0
    let pulse = 0

    const spawnSparkle = (x: number, y: number) => {
      if (sparkles.length > 30) return
      const ang = Math.random() * Math.PI * 2
      const sp = 12 + Math.random() * 22
      sparkles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 10,
        life: 0.4 + Math.random() * 0.2,
        max: 0.6,
        size: 1.5 + Math.random() * 2.5,
      })
    }

    const drawPenGlow = (x: number, y: number, alpha: number) => {
      const r = 30
      const grad = gctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`)
      grad.addColorStop(0.3, `rgba(214,204,255,${alpha * 0.7})`)
      grad.addColorStop(1, `rgba(168,85,247,0)`)
      gctx.fillStyle = grad
      gctx.beginPath()
      gctx.arc(x, y, r, 0, Math.PI * 2)
      gctx.fill()
    }

    const tick = (now: number) => {
      if (!running) return
      const t = now - startTs
      pulse += 0.06

      // Draw any steps whose time has come.
      while (nextStep < steps.length && steps[nextStep].t <= t) {
        const s = steps[nextStep]
        const w = Math.max(3, s.baseWidth * (0.5 + 0.5 * s.pressure) * 1.8)
        ictx.lineWidth = w
        ictx.beginPath()
        ictx.moveTo(s.x1, s.y1)
        ictx.quadraticCurveTo(s.cx, s.cy, s.x2, s.y2)
        ictx.stroke()
        pen = { x: s.x2, y: s.y2 }
        if (now - lastSpawn > 30) {
          spawnSparkle(s.x2, s.y2)
          lastSpawn = now
        }
        nextStep++
      }

      if (nextStep < steps.length) {
        penVisible = true
        penAlpha = Math.min(1, penAlpha + 0.12)
      } else {
        penAlpha = Math.max(0, penAlpha - 0.05)
        if (penAlpha <= 0) penVisible = false
      }

      // Glow canvas: redraw each frame (sparkles + pen tip).
      gctx.clearRect(0, 0, vw, vh)
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const p = sparkles[i]
        p.life -= 0.016
        if (p.life <= 0) {
          sparkles.splice(i, 1)
          continue
        }
        p.x += p.vx * 0.016
        p.y += p.vy * 0.016
        p.vy -= 6 * 0.016
        const a = (p.life / p.max) * 0.9
        const grad = gctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4)
        grad.addColorStop(0, `rgba(214,204,255,${a})`)
        grad.addColorStop(0.5, `rgba(168,85,247,${a * 0.4})`)
        grad.addColorStop(1, 'rgba(168,85,247,0)')
        gctx.fillStyle = grad
        gctx.beginPath()
        gctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
        gctx.fill()
      }
      if (penVisible && pen) {
        drawPenGlow(pen.x, pen.y, penAlpha * (0.7 + 0.3 * Math.sin(pulse)))
      }

      if (nextStep < steps.length || sparkles.length > 0 || penVisible) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
        setReplayDone(true)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
    }
  }, [strokes, hasStrokes, contained, region])

  if (!hasStrokes) return null

  const wrapperClass = contained
    ? `relative ${className ?? ''}`
    : 'fixed inset-0 z-20'
  const wrapperStyle = contained
    ? { pointerEvents: 'none' as const }
    : { pointerEvents: 'none' as const }

  // In contained mode, the canvases fill the parent (relative-wrapper). In
  // overlay mode, they fill the viewport and the region sub-divides them.
  const canvasStyle = contained
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%' }
    : region
      ? { left: `${region.offsetFraction * 100}%`, width: `${region.widthFraction * 100}%` }
      : undefined

  return (
    <motion.div
      className={wrapperClass}
      initial={{ opacity: 0 }}
      animate={{ opacity: replayDone && !contained ? 0 : 1 }}
      transition={{ duration: 1.0 }}
      style={wrapperStyle}
    >
      {/* ink layer */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={canvasStyle} />
      {/* glow layer */}
      <canvas ref={glowRef} className="absolute inset-0 h-full w-full" style={canvasStyle} />
    </motion.div>
  )
}
