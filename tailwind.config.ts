import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand purple (#6D5EF8) and its tonal range
        brand: {
          50: '#f3f1ff',
          100: '#e9e5ff',
          200: '#d6ccff',
          300: '#bba8ff',
          400: '#9c7bff',
          500: '#6D5EF8', // primary
          600: '#5b46e6',
          700: '#4a35c9',
          800: '#3c2ba1',
          900: '#322a7e',
        },
        lavender: {
          50: '#faf8ff',
          100: '#f1ecff',
          200: '#e3d8ff',
          300: '#cdb4ff',
        },
        // Luxury gold accent — for the signature neon glow, "Signed" label,
        // visitor-number badge highlight, and celebration warmth.
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#eab308', // primary gold
          500: '#d97706',
          600: '#b45309',
        },
        // Electric blue — interactive energy for refresh, links, nav hover,
        // and the "Next Visitor" button accent. Pairs cool against purple + gold.
        electric: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // primary electric
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        // Great Vibes = cursive display, Poppins = everything else
        cursive: ['"Great Vibes"', 'cursive'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // 24px premium rounded corners used throughout
        '4xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(109, 94, 248, 0.55)',
        'glow-lg': '0 0 70px -10px rgba(109, 94, 248, 0.7)',
        'glow-gold': '0 0 40px -8px rgba(234, 179, 8, 0.6)',
        'glow-electric': '0 0 40px -8px rgba(59, 130, 246, 0.6)',
        glass: '0 8px 32px 0 rgba(31, 28, 60, 0.18)',
        'glass-lg': '0 16px 48px -8px rgba(31, 28, 60, 0.28)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6D5EF8 0%, #9c7bff 50%, #bba8ff 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgba(109,94,248,0.15) 0%, rgba(156,123,255,0.12) 50%, rgba(187,168,255,0.10) 100%)',
        'gold-gradient': 'linear-gradient(135deg, #eab308 0%, #fde047 100%)',
        'electric-gradient': 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'breathing': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.04)', opacity: '1' },
        },
        'blink-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'ripple': {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
      },
      animation: {
        'gradient-shift': 'gradient-shift 12s ease infinite',
        'breathing': 'breathing 4s ease-in-out infinite',
        'blink-soft': 'blink-soft 2.5s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
