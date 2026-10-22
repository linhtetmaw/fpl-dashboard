/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        myanmar: ['Noto Sans Myanmar', 'Myanmar Text', 'Padauk', 'system-ui', 'sans-serif'],
      },
      colors: {
        /**
         * Theme colours are CSS variables (RGB channels, so opacity modifiers like /15 still work). Dark values are
         * the default; [data-theme='light'] swaps them (see index.css). Fixed colours below never change.
         */
        fpl: {
          /** Page background. */
          dark: 'rgb(var(--fpl-dark) / <alpha-value>)',
          /** Card / panel surface. */
          card: 'rgb(var(--fpl-card) / <alpha-value>)',
          /** Raised surface inside a card (tiles, inputs, table headers). */
          raised: 'rgb(var(--fpl-raised) / <alpha-value>)',
          border: 'rgb(var(--fpl-border) / <alpha-value>)',
          /** Filled buttons and active controls — bright Pitch Green in both themes; pair with text-fpl-purple/ink. */
          accent: '#00FF85',
          'accent-hover': '#00d970',
          /** Green for text and tints: Pitch Green on dark, a deeper green on light (bright green is unreadable on white). */
          brand: 'rgb(var(--fpl-brand) / <alpha-value>)',
          /** Core brand purple (text on green, logo tile). Fixed. */
          purple: '#37003C',
          /** Dark text on bright fills (green, amber) in both themes. Fixed. */
          ink: '#13001a',
          /** Pure white that stays white in both themes (text on red/green badges, pitch markings). */
          snow: '#ffffff',
          plum: '#6B4A70',
          mist: '#F5F2F6',
          pitch: '#0f3b24',
          'pitch-line': '#2b6a45',
        },
        /** "white" is the main text colour: white on dark, brand purple on light. Use fpl-snow for a fixed white. */
        white: 'rgb(var(--c-white) / <alpha-value>)',
        /** Purple-tinted neutrals; the scale reverses in light mode so text-slate-300 etc. stay readable. */
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
