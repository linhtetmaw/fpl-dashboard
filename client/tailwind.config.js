/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        fpl: {
          green: '#3d195b',
          accent: '#0f4c9b',
          'accent-hover': '#0a3a6b',
          dark: '#0f0a1a',
          card: '#1a1425',
          border: '#2d2440',
        },
      },
    },
  },
  plugins: [],
};
