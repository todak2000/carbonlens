/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a1015',
        teal: {
          DEFAULT: '#00b89a',
          dark: '#007a66',
          light: '#e0f7f3',
        },
        amber: {
          DEFAULT: '#e8820a',
          light: '#fef3e2',
        },
        blue: {
          DEFAULT: '#1a6fa8',
          light: '#e8f2fb',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
