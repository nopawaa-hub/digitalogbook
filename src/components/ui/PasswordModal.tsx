import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, ShieldAlert, X } from 'lucide-react'
import { GlowButton } from './GlowButton'
import { sound } from '@/lib/sound'

interface PasswordModalProps {
  open: boolean
  /** Title shown in the modal. */
  title: string
  /** Fired with no args when the correct password is entered. */
  onAuthorized: () => void
  /** Fired when dismissed (X / backdrop) without authorizing. */
  onClose: () => void
}

// NOTE: client-side check only — a soft guard against accidental clears at a
// shared booth, not real security (the value is visible in the bundle source).
// Real auth (Firebase Auth / admin role) is a documented follow-up.
const PASSWORD = 'Naufal0221'

/**
 * Password gate modal.
 *
 * Flow:
 *   1. Visitor enters a password and confirms.
 *   2. If incorrect → swap to an "incorrect password" view offering Try Again
 *      (returns to the entry view) or Close (dismisses entirely).
 *   3. If correct → call onAuthorized() and close.
 */
export function PasswordModal({ open, title, onAuthorized, onClose }: PasswordModalProps) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setValue('')
      setWrong(false)
      setError(null)
      // Focus the field shortly after the open animation.
      const t = window.setTimeout(() => inputRef.current?.focus(), 120)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const submit = () => {
    if (!value.trim()) {
      setError('Please enter the password.')
      return
    }
    if (value === PASSWORD) {
      sound.play('click')
      onAuthorized()
    } else {
      sound.play('click')
      setWrong(true)
      setError(null)
    }
  }

  const tryAgain = () => {
    sound.play('click')
    setValue('')
    setWrong(false)
    inputRef.current?.focus()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Blurred backdrop */}
          <div
            className="absolute inset-0 bg-brand-900/40 backdrop-blur-xl"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-white/40 bg-white/80 p-6 shadow-glass-lg backdrop-blur-xl sm:p-8"
          >
            {/* Close button */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                sound.play('click')
                onClose()
              }}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-50"
            >
              <X className="h-5 w-5" />
            </button>

            {wrong ? (
              // ── Incorrect password view ──
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-500"
                >
                  <ShieldAlert className="h-8 w-8" />
                </motion.div>
                <h3 className="text-xl font-semibold text-brand-800">Password incorrect</h3>
                <p className="mt-2 text-sm text-slate-500">
                  The password you entered is not correct. Please try again or close
                  this dialog.
                </p>
                <div className="mt-6 flex w-full gap-3">
                  <GlowButton
                    variant="ghost"
                    className="flex-1 border-rose-200 text-rose-500"
                    onClick={onClose}
                  >
                    Close
                  </GlowButton>
                  <GlowButton className="flex-1" onClick={tryAgain}>
                    Try Again
                  </GlowButton>
                </div>
              </div>
            ) : (
              // ── Password entry view ──
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow"
                >
                  <Lock className="h-8 w-8" />
                </motion.div>
                <h3 className="text-xl font-semibold text-brand-800">{title}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  This action is protected. Enter the password to continue.
                </p>
                <input
                  ref={inputRef}
                  type="password"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    if (error) setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                  }}
                  placeholder="Password"
                  className="mt-5 w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-center text-base text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-300/30"
                />
                {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
                <div className="mt-5 flex w-full gap-3">
                  <GlowButton variant="ghost" className="flex-1" onClick={onClose}>
                    Cancel
                  </GlowButton>
                  <GlowButton className="flex-1" onClick={submit}>
                    Confirm
                  </GlowButton>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
