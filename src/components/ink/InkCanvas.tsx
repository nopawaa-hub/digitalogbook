import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Undo2, Redo2, Trash2, Maximize2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { StrokeEngine, type SerializedStrokes } from './StrokeEngine'
import { SparkleLayer } from './SparkleLayer'
import { sound } from '@/lib/sound'
import { cappedDPR, cn } from '@/lib/utils'

/** Imperative API exposed to parents (for submit export + toolbar wiring). */
export interface InkCanvasHandle {
  clear: () => void
  undo: () => void
  redo: () => void
  hasInk: () => boolean
  /** PNG data URL (transparent bg) — for Firebase Storage upload. */
  toDataURL: () => string
  /** PNG data URL with opaque white background. */
  toDataURLWhiteBg: () => string
  /** Replace canvas contents with an imported PNG data URL. */
  loadImage: (dataUrl: string) => Promise<void>
  /** Serialized strokes for the celebration replay animation. */
  getStrokes: () => SerializedStrokes
}

interface InkCanvasProps {
  /** Marker label shown in the toolbar, e.g. "Handwritten comment". */
  label?: string
  className?: string
  /** Ink color (CSS). Default near-black premium ink. */
  color?: string
  /** Base stroke width in CSS px. */
  baseWidth?: number
  /** When true, ink glow stays violet (signature style). When false, plain black. */
  signatureStyle?: boolean
  /** Notified whenever ink presence changes (for validation/submit gating). */
  onInkChange?: (hasInk: boolean) => void
  /** Set false to hide the toolbar (Clear/Undo/Redo). */
  showToolbar?: boolean
  placeholder?: string
  /**
   * Renders an "expand" (Maximize) button in the toolbar. The parent receives
   * the current ink via onExpand so it can open a fullscreen modal, then pipes
   * the result back through the imperative loadImage().
   */
  expandable?: boolean
  /** Fired when the expand button is tapped; parent should open the full view. */
  onExpand?: (currentInkDataUrl: string) => void
}

/**
 * Two stacked canvases:
 *   - bottom (opaque-ish): the persistent clean ink layer (StrokeEngine)
 *   - top (transparent):   the magical fairy-dust overlay (SparkleLayer)
 *
 * Input is captured on the TOP canvas (pointer-events on it), reads pressure
 * and coalesced events, and forwards points to both layers. Supports finger,
 * stylus, S Pen, and Apple Pencil via Pointer Events.
 */
export const InkCanvas = forwardRef<InkCanvasHandle, InkCanvasProps>(
  function InkCanvas(props, ref) {
    const {
      label,
      className,
      color = '#111827',
      baseWidth = 3.2,
      signatureStyle = false,
      onInkChange,
      showToolbar = true,
      placeholder = 'Write here…',
      expandable = false,
      onExpand,
    } = props

    const containerRef = useRef<HTMLDivElement | null>(null)
    const inkCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const fxCanvasRef = useRef<HTMLCanvasElement | null>(null)

    const engineRef = useRef<StrokeEngine | null>(null)
    const fxRef = useRef<SparkleLayer | null>(null)
    const hasInkRef = useRef(false)
    const drawingRef = useRef(false)
    const onInkChangeRef = useRef(onInkChange)
    onInkChangeRef.current = onInkChange
    const onExpandRef = useRef(onExpand)
    onExpandRef.current = onExpand

    // Pen thickness — three presets the visitor can pick from.
    const THICKNESS_PRESETS = [
      { label: 'Fine', value: 2.5 },
      { label: 'Medium', value: 5.5 },
      { label: 'Bold', value: 9 },
    ] as const
    const [thicknessIdx, setThicknessIdx] = useState(1) // default Medium

    // Apply the selected thickness to the engine so new strokes use it.
    useEffect(() => {
      if (engineRef.current) {
        engineRef.current.baseWidth = THICKNESS_PRESETS[thicknessIdx].value
      }
    }, [thicknessIdx])

    /** (Re)size both canvases to the container, preserving DPR crispness. */
    const resize = useCallback(() => {
      const container = containerRef.current
      const inkCanvas = inkCanvasRef.current
      const fxCanvas = fxCanvasRef.current
      if (!container || !inkCanvas || !fxCanvas) return

      const dpr = cappedDPR(2)
      const rect = container.getBoundingClientRect()
      const cssW = Math.max(rect.width, 1)
      const cssH = Math.max(rect.height, 1)

      // Preserve existing ink across resizes by snapshotting.
      const hadInk = engineRef.current?.hasInk() ?? false
      const snapshot = hadInk ? inkCanvas.toDataURL('image/png') : null

      for (const c of [inkCanvas, fxCanvas]) {
        c.style.width = `${cssW}px`
        c.style.height = `${cssH}px`
        c.width = Math.round(cssW * dpr)
        c.height = Math.round(cssH * dpr)
      }

      const ctx = inkCanvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
      const fxCtx = fxCanvas.getContext('2d')
      if (fxCtx) fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Restore ink snapshot (drawn in CSS px because of the transform).
      if (snapshot) {
        const img = new Image()
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, cssW, cssH)
        }
        img.src = snapshot
      }
    }, [])

    const notifyInk = useCallback((has: boolean) => {
      if (hasInkRef.current !== has) {
        hasInkRef.current = has
        onInkChangeRef.current?.(has)
      }
    }, [])

    // Lazy-init the engine + fx layer once the canvases mount.
    const ensureEngine = useCallback(() => {
      if (engineRef.current || !inkCanvasRef.current) return
      engineRef.current = new StrokeEngine(inkCanvasRef.current, {
        color,
        // Use the current thickness preset rather than the static prop.
        baseWidth: THICKNESS_PRESETS[thicknessIdx].value ?? baseWidth,
      })
      if (fxCanvasRef.current) {
        fxRef.current = new SparkleLayer(fxCanvasRef.current)
      }
    }, [color, baseWidth, thicknessIdx])

    // Pointer handlers operate in CSS pixels (canvas contexts are scaled by DPR).
    const pointFromEvent = useCallback(
      (e: PointerEvent): { x: number; y: number; p: number } => {
        const canvas = fxCanvasRef.current!
        const rect = canvas.getBoundingClientRect()
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          p: e.pressure,
        }
      },
      [],
    )

    const handleDown = useCallback(
      (e: PointerEvent) => {
        e.preventDefault()
        ensureEngine()
        const engine = engineRef.current
        const fx = fxRef.current
        if (!engine) return
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        drawingRef.current = true
        const { x, y, p } = pointFromEvent(e)
        engine.beginStroke(x, y, p)
        fx?.setPen(x, y, true)
        fx?.start()
        sound.startScribble()
        notifyInk(true)
      },
      [ensureEngine, pointFromEvent, notifyInk],
    )

    const handleMove = useCallback(
      (e: PointerEvent) => {
        if (!drawingRef.current) return
        e.preventDefault()
        const engine = engineRef.current
        const fx = fxRef.current
        if (!engine) return

        // Use coalesced events for sub-frame smoothness on capable devices.
        const events =
          typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
        const list = events.length ? events : [e]
        const canvas = fxCanvasRef.current!
        const rect = canvas.getBoundingClientRect()
        for (const ev of list) {
          const x = ev.clientX - rect.left
          const y = ev.clientY - rect.top
          engine.extendStroke(x, y, ev.pressure)
          fx?.setPen(x, y, true)
        }
      },
      [],
    )

    const endStroke = useCallback(() => {
      if (!drawingRef.current) return
      drawingRef.current = false
      const engine = engineRef.current
      const fx = fxRef.current
      engine?.endStroke()
      fx?.releasePen()
      sound.stopScribble()
      notifyInk(!!engine?.hasInk())
    }, [notifyInk])

    const handleUp = useCallback(
      (e: PointerEvent) => {
        e.preventDefault()
        try {
          ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        } catch {
          /* ignore */
        }
        endStroke()
      },
      [endStroke],
    )

    const handleCancel = useCallback(() => {
      engineRef.current?.cancelStroke()
      fxRef?.current?.releasePen()
      drawingRef.current = false
      sound.stopScribble()
      notifyInk(!!engineRef.current?.hasInk())
    }, [notifyInk])

    // Attach raw pointer listeners + keep the canvas buffer in sync with its
    // container via a ResizeObserver. Runs once on mount with cleanup, so it
    // survives React StrictMode's double-mount in dev without leaking listeners.
    // We use raw DOM listeners (not React pointer props) because synthetic
    // events don't reliably expose getCoalescedEvents().
    useEffect(() => {
      const fxCanvas = fxCanvasRef.current
      if (!fxCanvas) return

      fxCanvas.style.touchAction = 'none'
      fxCanvas.addEventListener('pointerdown', handleDown)
      fxCanvas.addEventListener('pointermove', handleMove)
      fxCanvas.addEventListener('pointerup', handleUp)
      fxCanvas.addEventListener('pointercancel', handleCancel)
      fxCanvas.addEventListener('pointerleave', endStroke)

      // Initial size (container may still be animating in; ResizeObserver
      // will correct it when layout settles).
      resize()

      // Re-size whenever the container actually changes (responsive
      // breakpoints, animation completing, window resize). Without this the
      // drawing buffer drifts out of sync with the visible area and strokes
      // get clipped / drawn in the wrong place.
      const container = containerRef.current
      let ro: ResizeObserver | undefined
      if (container && 'ResizeObserver' in window) {
        ro = new ResizeObserver(() => resize())
        ro.observe(container)
      } else {
        // Fallback for very old browsers.
        window.addEventListener('resize', resize)
      }

      return () => {
        fxCanvas.removeEventListener('pointerdown', handleDown)
        fxCanvas.removeEventListener('pointermove', handleMove)
        fxCanvas.removeEventListener('pointerup', handleUp)
        fxCanvas.removeEventListener('pointercancel', handleCancel)
        fxCanvas.removeEventListener('pointerleave', endStroke)
        ro?.disconnect()
        window.removeEventListener('resize', resize)
      }
    }, [handleDown, handleMove, handleUp, handleCancel, endStroke, resize])

    useImperativeHandle(
      ref,
      (): InkCanvasHandle => ({
        clear: () => {
          engineRef.current?.clear()
          fxRef.current?.stop()
          notifyInk(false)
        },
        undo: () => {
          engineRef.current?.undo()
          notifyInk(!!engineRef.current?.hasInk())
        },
        redo: () => {
          engineRef.current?.redo()
          notifyInk(!!engineRef.current?.hasInk())
        },
        hasInk: () => !!engineRef.current?.hasInk(),
        toDataURL: () => {
          ensureEngine()
          const c = inkCanvasRef.current
          return c ? c.toDataURL('image/png') : ''
        },
        toDataURLWhiteBg: () => {
          ensureEngine()
          return engineRef.current?.toDataURLWhiteBg() ?? ''
        },
        loadImage: async (dataUrl: string) => {
          ensureEngine()
          await engineRef.current?.loadImage(dataUrl)
          notifyInk(!!engineRef.current?.hasInk())
        },
        getStrokes: () => {
          ensureEngine()
          return (
            engineRef.current?.getStrokes() ?? { width: 0, height: 0, strokes: [] }
          )
        },
      }),
      [ensureEngine, notifyInk],
    )

    // Shared canvas style object.
    const canvasStyle: CSSProperties = {
      position: 'absolute',
      inset: 0,
      touchAction: 'none',
      borderRadius: 'inherit',
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden rounded-3xl border border-white/30 bg-white/70 shadow-glass backdrop-blur-sm',
          className,
        )}
      >
        {/* ink layer (persisted) */}
        <canvas
          ref={inkCanvasRef}
          style={{ ...canvasStyle, zIndex: 1 }}
          aria-label={label ?? 'Handwriting canvas'}
          role="img"
        />
        {/* effect overlay (transparent, captures pointer) */}
        <canvas
          ref={fxCanvasRef}
          style={{ ...canvasStyle, zIndex: 2 }}
          aria-hidden="true"
        />

        {/* Placeholder hint when empty */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: hasInkRef.current ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center px-6 text-center text-base text-brand-500/40 sm:text-lg"
          style={{ fontFamily: signatureStyle ? '"Great Vibes", cursive' : 'Poppins' }}
        >
          {placeholder}
        </motion.div>

        {/* Toolbar */}
        {showToolbar && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
            {/* Pen thickness selector */}
            <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/60 p-1 backdrop-blur-md">
              {THICKNESS_PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.label}
                  aria-label={`Pen thickness: ${preset.label}`}
                  onClick={() => {
                    sound.play('click')
                    setThicknessIdx(i)
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                    thicknessIdx === i ? 'bg-brand-gradient' : 'hover:bg-white/70'
                  }`}
                >
                  <span
                    className="block rounded-full"
                    style={{
                      width: `${preset.value}px`,
                      height: `${preset.value}px`,
                      backgroundColor: thicknessIdx === i ? '#fff' : '#6D5EF8',
                    }}
                  />
                </button>
              ))}
            </div>
            <ToolbarButton label="Undo" onClick={() => engineRef.current?.undo()}>
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Redo" onClick={() => engineRef.current?.redo()}>
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Clear" onClick={() => engineRef.current?.clear()}>
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
            {expandable && (
              <ToolbarButton
                label="Expand"
                onClick={() => {
                  ensureEngine()
                  const c = inkCanvasRef.current
                  onExpandRef.current?.(c ? c.toDataURL('image/png') : '')
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </ToolbarButton>
            )}
          </div>
        )}

        {label && (
          <div className="absolute left-4 top-3 z-10 text-[11px] font-medium uppercase tracking-wider text-brand-500/60">
            {label}
          </div>
        )}
      </div>
    )
  },
)

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.06 }}
      onClick={() => {
        sound.play('click')
        onClick()
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/70 text-brand-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white"
    >
      {children}
    </motion.button>
  )
}
