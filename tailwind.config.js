/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        route1: '#2563eb',
        route2: '#f97316',
      },
      height: {
        panel: '100%',
      },
    },
  },
  plugins: [],
}