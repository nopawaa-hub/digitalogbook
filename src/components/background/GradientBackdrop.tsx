/**
 * Animated multi-color gradient backdrop.
 *
 * Five large blurred blobs in the brand palette (purple, lavender, gold,
 * electric blue) slowly drift and pulse behind everything, plus a slowly
 * shifting gradient wash. Done with CSS only (no canvas) so it costs almost
 * nothing and stays off the rAF budget reserved for ink.
 *
 * Fixed to the viewport, behind all content (-z).
 */
export function GradientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash — now spans purple → lavender → soft blue */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-lavender-100 to-electric-50" />

      {/* Slowly shifting animated gradient layer (all three hues) */}
      <div
        className="absolute inset-0 opacity-75"
        style={{
          background:
            'linear-gradient(120deg, #6D5EF8 0%, #9c7bff 25%, #60a5fa 55%, #eab308 80%, #bba8ff 100%)',
          backgroundSize: '300% 300%',
          mixBlendMode: 'soft-light',
          animation: 'gradient-shift 16s ease infinite',
        }}
      />

      {/* Drifting blobs — purple (primary) */}
      <div
        className="absolute -left-32 -top-32 h-[42rem] w-[42rem] rounded-full opacity-45 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(109,94,248,0.6), transparent 60%)',
          animation: 'float-slow 9s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-40 top-1/4 h-[38rem] w-[38rem] rounded-full opacity-40 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(156,123,255,0.55), transparent 60%)',
          animation: 'float-slow 11s ease-in-out infinite reverse',
        }}
      />

      {/* Lavender blob (bottom-center) */}
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(187,168,255,0.6), transparent 60%)',
          animation: 'float-slow 13s ease-in-out infinite',
        }}
      />

      {/* Gold blob (lower-right) — warm luxury accent */}
      <div
        className="absolute -bottom-24 right-10 h-[30rem] w-[30rem] rounded-full opacity-25 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(234,179,8,0.5), transparent 60%)',
          animation: 'float-slow 14s ease-in-out infinite',
        }}
      />

      {/* Electric blue blob (upper-left, mid) — cool interactive accent */}
      <div
        className="absolute left-1/4 top-1/2 h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.55), transparent 60%)',
          animation: 'float-slow 12s ease-in-out infinite reverse',
        }}
      />

      {/* A second smaller gold + blue pair for color richness across the frame */}
      <div
        className="absolute left-10 bottom-1/4 h-[20rem] w-[20rem] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(253,224,71,0.5), transparent 60%)',
          animation: 'float-slow 10s ease-in-out infinite',
        }}
      />
      <div
        className="absolute right-1/3 -top-20 h-[24rem] w-[24rem] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(96,165,250,0.5), transparent 60%)',
          animation: 'float-slow 15s ease-in-out infinite',
        }}
      />
    </div>
  )
}
