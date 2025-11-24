/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: '#E11D48', // Rose 600
        secondary: '#1E293B', // Slate 800
        accent: '#F43F5E', // Rose 500
        background: '#0F172A', // Slate 900
        surface: '#1E293B', // Slate 800
        text: '#F8FAFC', // Slate 50
      }
    },
  },
  plugins: [],
}
