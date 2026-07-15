import { motion } from 'framer-motion'
import { PenLine, BookOpen, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'

export type NavSection = 'sign' | 'logs' | 'judges'

interface NavBarProps {
  active: NavSection
  onChange: (section: NavSection) => void
}

/**
 * Floating glass navigation pill, fixed to the top-center of the viewport.
 *
 * Two tabs:
 *   - "Sign the Guestbook"  → the signing flow (welcome → form → celebration)
 *   - "View the Visitor Logs" → the read-only list of signed entries
 *
 * Rendered by App on all screens except the momentary celebration animation,
 * so visitors at the booth can switch between signing and browsing at any time.
 */
export function NavBar({ active, onChange }: NavBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/40 bg-white/60 p-1 shadow-glass backdrop-blur-xl">
        <NavTab active={active === 'sign'} onClick={() => onChange('sign')}>
          <PenLine className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">Sign the Guestbook</span>
          <span className="xs:hidden sm:hidden">Sign</span>
        </NavTab>
        <NavTab active={active === 'logs'} onClick={() => onChange('logs')}>
          <BookOpen className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">View the Visitor Logs</span>
          <span className="xs:hidden sm:hidden">Logs</span>
        </NavTab>
        <NavTab active={active === 'judges'} onClick={() => onChange('judges')}>
          <Scale className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">Judge Assessment</span>
          <span className="xs:hidden sm:hidden">Judges</span>
        </NavTab>
      </nav>
    </div>
  )
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.03 }}
      onClick={() => {
        sound.play('click')
        onClick()
      }}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4',
        active
          ? 'bg-brand-gradient text-white shadow-sm'
          : 'text-electric-700 hover:bg-electric-50',
      )}
    >
      {children}
    </motion.button>
  )
}
