/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stellar: {
          50: '#f0f4ff',
          100: '#dbe5ff',
          500: '#3e63dd',
          600: '#3352c4',
          900: '#0f172a'
        }
      }
    },
  },
  plugins: [],
}
