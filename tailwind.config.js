/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050403',
        coal: '#120b07',
        ember: '#d24a16',
        cream: '#e5bd83',
        mustard: '#c98b43',
      },
      boxShadow: { glow: '0 16px 48px rgba(210, 74, 22, .18)' },
    },
  },
  plugins: [],
}
