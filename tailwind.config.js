/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f2d3a0',
        coal: '#bd1d25',
        ember: '#a40f18',
        cream: '#f8e2b7',
        mustard: '#e8c381',
      },
      boxShadow: { glow: '0 16px 48px rgba(103, 12, 18, .24)' },
    },
  },
  plugins: [],
}
