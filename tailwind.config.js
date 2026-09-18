/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#ffb71b',
        coal: '#bd1d25',
        ember: '#a40f18',
        cream: '#fff0cb',
        mustard: '#ffe1a1',
      },
      boxShadow: { glow: '0 16px 48px rgba(103, 12, 18, .24)' },
    },
  },
  plugins: [],
}
