import { useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'
import { sound } from '@/lib/sound'

/**
 * Minimal corner sound toggle. Sounds start MUTED (exhibition booths are
 * shared acoustic spaces). Tap to enable subtle UI sounds for this session.
 */
export function SoundToggle() {
  const [muted, setMuted] = useState(sound.isMuted)

  const toggle = () => {
    const next = sound.toggleMuted()
    setMuted(next)
    // Play a soft click so the visitor hears it worked (only if now unmuted).
    if (!next) sound.play('click')
  }

  return (
    <motion.button
      type="button"
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Sounds muted — tap to enable' : 'Sounds on — tap to mute'}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.08 }}
      onClick={toggle}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/60 text-brand-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80"
    >
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </motion.button>
  )
}
