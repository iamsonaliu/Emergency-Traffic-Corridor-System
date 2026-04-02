/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#0d0f0f',
          secondary: '#131616',
          tertiary:  '#1a1e1e',
          card:      '#161b1b',
          hover:     '#1f2626',
        },
        border: {
          DEFAULT: '#1f2b2b',
          bright:  '#2d3f3f',
        },
        green: {
          DEFAULT: '#10b981',
          bright:  '#34d399',
          dim:     '#065f46',
          glow:    'rgba(16,185,129,0.15)',
        },
        red: {
          DEFAULT: '#ef4444',
          dim:     '#7f1d1d',
        },
        amber: {
          DEFAULT: '#f59e0b',
          dim:     '#78350f',
        },
        text: {
          primary:   '#e2e8e8',
          secondary: '#6b7f7f',
          muted:     '#374444',
          accent:    '#10b981',
        },
      },
      fontFamily: {
        mono:    ['"Share Tech Mono"', 'monospace'],
        display: ['Rajdhani', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulseGreen 2s infinite',
        'pulse-red':   'pulseRed 1s infinite',
        'blink':       'blink 1s infinite',
        'fade-up':     'fadeUp 0.3s ease forwards',
        'scan':        'scan 3s linear infinite',
      },
      keyframes: {
        pulseGreen: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.4)' },
          '50%':     { boxShadow: '0 0 0 6px rgba(16,185,129,0)' },
        },
        pulseRed: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.5)' },
          '50%':     { boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
        },
        blink: {
          '0%,100%': { opacity: 1 },
          '50%':     { opacity: 0.2 },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
      },
    },
  },
  plugins: [],
}