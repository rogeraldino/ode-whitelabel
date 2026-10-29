/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'platform': {
          'blue': '#021D40',
          'orange': '#F26A1B',
          'peach': '#F29E6D',
          'white': '#F2F2F2',
          'black': '#0D0D0D',
          'yellow': '#FFB848',
        },
      },
    },
  },
  plugins: [],
} 