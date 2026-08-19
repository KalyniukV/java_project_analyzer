/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        'surface-border': '#30363d',
        primary: '#38bdf8', // Neon Sky Blue
        outbound: '#fb923c', // Orange/Amber
        inbound: '#38bdf8', // Blue
        mutual: '#f43f5e', // Rose/Red
        cycle: '#ef4444',
      }
    },
  },
  plugins: [],
}
