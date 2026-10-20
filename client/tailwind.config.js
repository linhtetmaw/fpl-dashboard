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
        fpl: {
          /** Page background (deep FPL House purple). */
          dark: '#13001a',
          /** Card / panel surface. */
          card: '#1c0524',
          /** Raised surface inside a card (tiles, inputs, table headers). */
          raised: '#270b30',
          border: '#3a1842',
          /** Filled buttons and active controls — Pitch Green; pair with text-fpl-purple. */
          accent: '#00FF85',
          'accent-hover': '#00d970',
          /** Pitch Green for text, highlights and points on dark surfaces. */
          brand: '#00FF85',
          /** Core brand purple (text on green, logo tile). */
          purple: '#37003C',
          plum: '#6B4A70',
          mist: '#F5F2F6',
          pitch: '#0f3b24',
          'pitch-line': '#2b6a45',
        },
        /** Neutrals re-tinted toward the brand purple, so every text-slate-* matches. */
        slate: {
          50: '#faf8fb',
          100: '#f5f2f6',
          200: '#e6dce8',
          300: '#c9b3cc',
          400: '#a68dab',
          500: '#836a89',
          600: '#6b4a70',
          700: '#4f3354',
          800: '#3a2140',
          900: '#26112b',
          950: '#170619',
        },
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
