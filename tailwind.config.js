/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'space-grotesk': ['Space Grotesk', 'sans-serif'],
        'abeezee': ['ABeeZee', 'sans-serif'],
      },
      colors: {
        'custom-black': '#000000',
        'custom-gray-1': '#8A8890', 
        'custom-gray-2': '#9095A1',
        'custom-white': '#FFFFFF',
      },
      backgroundImage: {
        'green-linear': 'linear-gradient(to bottom, #2BFFFF, #1CA3A3)',
        'green-linear-br': 'linear-gradient(to bottom right, #2BFFFF, #1CA3A3)',
      }
    },
  },
  plugins: [],
} 