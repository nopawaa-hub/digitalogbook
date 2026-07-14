import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { GlowButton } from './GlowButton'
import { sound } from '@/lib/sound'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  /** Label for the destructive confirm button (e.g. "Yes, delete"). */
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation modal — a final "are you sure?" gate before a destructive
 * action runs. Offered only AFTER the password gate has authorized.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-brand-900/40 backdrop-blur-xl"
            onClick={() => {
              sound.play('click')
              onCancel()
            }}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-4xl border border-white/40 bg-white/80 p-6 shadow-glass-lg backdrop-blur-xl sm:p-8"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                sound.play('click')
                onCancel()
              }}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-50"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-500"
              >
                <AlertTriangle className="h-8 w-8" />
              </motion.div>
              <h3 className="text-xl font-semibold text-brand-800">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{message}</p>
              <div className="mt-6 flex w-full gap-3">
                <GlowButton variant="ghost" className="flex-1" onClick={onCancel}>
                  No
                </GlowButton>
                <GlowButton
                  className="flex-1 border-rose-300 bg-rose-500"
                  onClick={() => {
                    sound.play('click')
                    onConfirm()
                  }}
                >
                  {confirmLabel}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
