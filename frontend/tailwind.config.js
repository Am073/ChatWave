/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cw: {
          black: '#050709',
          surface: '#0c0f17',
          card: '#111520',
          blue: '#2563eb',
          'blue-light': '#3b82f6',
          teal: '#0d9488',
          'teal-light': '#14b8a6',
          amber: '#f59e0b',
          green: '#10b981',
          red: '#ef4444',
          purple: '#7c3aed',
          t1: '#f1f5f9',
          t2: '#94a3b8',
          t3: '#475569',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'orb-spin': 'orb-spin 6s linear infinite',
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
      },
      keyframes: {
        'orb-spin': { to: { transform: 'rotate(360deg)' } },
        'pulse-dot': {
          '0%, 60%, 100%': { transform: 'scale(0.7)', opacity: '0.4' },
          '30%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      borderWidth: { '0.5': '0.5px' },
      boxShadow: {
        glow: '0 0 40px rgba(59,130,246,0.35)',
        'glow-sm': '0 4px 24px rgba(37,99,235,0.25)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
