/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#0D0F14',
        slate: '#1A1D26',
        panel: '#22263A',
        border: '#2E3350',
        muted: '#4A5068',
        ghost: '#8B93B0',
        cream: '#E8E6E0',
        accent: '#5B8AF0',
        'accent-dim': '#2A3F7A',
        danger: '#E05252',
        'danger-dim': '#4A1A1A',
        warn: '#E8A030',
        'warn-dim': '#3D2A0A',
        safe: '#3DBE7A',
        'safe-dim': '#0D3320',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}