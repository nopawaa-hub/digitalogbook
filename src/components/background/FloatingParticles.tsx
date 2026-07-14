import { useEffect, useRef } from 'react'
import { cappedDPR } from '@/lib/utils'

/**
 * Floating glowing particles for the welcome / attract screen.
 *
 * One canvas, one rAF loop. Particles are slow-moving soft glows that drift
 * upward and wrap — "fairy dust in the air". Count and DPR are capped so this
 * never threatens the ink engine's frame budget on the tablet.
 */

interface Particle {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  alpha: number
  pulse: number
  phase: number
  /** Base hue — distributed across purple / gold / blue for color richness. */
  hue: number
}

const PARTICLE_COUNT = 36

export function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let raf = 0
    let running = true
    let lastTs = performance.now()

    const particles: Particle[] = []

    const dpr = cappedDPR(1.5) // deliberately low — these are background glows

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const seed = () => {
      particles.length = 0
      const w = window.innerWidth
      const h = window.innerHeight
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Distribute hues: ~60% purple, ~20% gold, ~20% electric blue.
        const r = Math.random()
        const hue =
          r < 0.6 ? 260 + Math.random() * 25 // purple/violet
          : r < 0.8 ? 45 + Math.random() * 12 // gold
          : 210 + Math.random() * 15 // electric blue
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 3.5,
          vx: (Math.random() - 0.5) * 6,
          vy: -8 - Math.random() * 16, // drift upward
          alpha: 0.15 + Math.random() * 0.5,
          pulse: 0.5 + Math.random() * 1.5,
          phase: Math.random() * Math.PI * 2,
          hue,
        })
      }
    }

    const tick = (ts: number) => {
      if (!running) return
      const dt = Math.min((ts - lastTs) / 1000, 0.05)
      lastTs = ts
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.phase += dt * p.pulse
        if (p.y < -20) {
          // wrap to bottom
          p.y = h + 20
          p.x = Math.random() * w
        }
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20

        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.phase))
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
        // Bright core + mid + transparent edge, all tinted to the particle's hue.
        grad.addColorStop(0, `hsla(${p.hue}, 90%, 88%, ${a})`)
        grad.addColorStop(0.5, `hsla(${p.hue}, 85%, 65%, ${a * 0.4})`)
        grad.addColorStop(1, `hsla(${p.hue}, 80%, 60%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(tick)
    }

    const onResize = () => {
      resize()
      seed()
    }

    resize()
    seed()
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  )
}
