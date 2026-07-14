import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-aware className merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Distance between two points. */
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1)
}

/** Format a visitor number with thousands separators. */
export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * Detect a coarse device label from the user agent (stored on each submission).
 * Returns a short human string, never thrown.
 */
export function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Other'
}

/** Detect a coarse browser label. */
export function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/Edg/i.test(ua)) return 'Edge'
  if (/Chrome/i.test(ua)) return 'Chrome'
  if (/Safari/i.test(ua)) return 'Safari'
  if (/Firefox/i.test(ua)) return 'Firefox'
  return 'Other'
}

/**
 * Cap the device pixel ratio. Tablets commonly report DPR 3+, which makes a
 * full-screen handwriting canvas prohibitively expensive. 2 is crisp for ink
 * without destroying frame budget.
 */
export function cappedDPR(max = 2): number {
  if (typeof window === 'undefined') return 1
  return Math.min(window.devicePixelRatio || 1, max)
}

/** Read a value from localStorage with a fallback (SSR/privacy-mode safe). */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Write a value to localStorage, swallowing quota/privacy errors. */
export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** Duplicate-submission window (seconds) — original prompt requirement. */
export const DUPLICATE_WINDOW_SECONDS = 30

/** Milliseconds since epoch, or null if within the last `seconds`. */
export function lastSubmissionAgeMs(): number | null {
  const raw = readLocal('eslc:lastSubmission')
  if (!raw) return null
  const ts = Number(raw)
  return Number.isNaN(ts) ? null : Date.now() - ts
}

/** Record a submission timestamp for the duplicate-guard. */
export function markSubmittedNow(): void {
  writeLocal('eslc:lastSubmission', String(Date.now()))
}

/** True if a submission was recorded within the last `seconds`. */
export function isWithinDuplicateWindow(seconds: number): boolean {
  const age = lastSubmissionAgeMs()
  return age !== null && age < seconds * 1000
}

/** Promise-based delay. */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
