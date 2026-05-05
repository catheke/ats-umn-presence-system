/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eff6ff',
          100: '#dbeafe',
          600: '#1e40af',
          700: '#1d3461',
          800: '#0f2d5c',
          900: '#0a1f3f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
