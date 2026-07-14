import { useEffect, useRef } from 'react'

/**
 * Resettable idle timer.
 *
 * Listens for user activity (pointer, touch, keyboard, wheel) and fires
 * `onIdle` after `timeoutMs` of inactivity. The timer resets on any activity
 * and also on re-render when `enabled` flips to true (so returning to an
 * active screen restarts the countdown).
 *
 * Used for attract mode: 45s on the form, 10s after the celebration.
 */
export function useIdleTimer(
  onIdle: () => void,
  timeoutMs: number,
  enabled: boolean,
): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return

    let timer: number | undefined

    const reset = (): void => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        onIdleRef.current()
      }, timeoutMs)
    }

    // Activity events that should reset the countdown.
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ]

    // Throttle the reset on continuous pointer movement to avoid resetting
    // hundreds of times during a single stroke.
    let lastReset = 0
    const onActivity = (): void => {
      const now = Date.now()
      if (now - lastReset < 1000) return
      lastReset = now
      reset()
    }

    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    reset()

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [timeoutMs, enabled])
}
