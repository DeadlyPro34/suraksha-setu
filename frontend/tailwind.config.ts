import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
      },
      colors: {
        // Re-mapped so every existing blue-* class across all pages picks up the new river palette.
        blue: {
          50: '#EEF6F8', 100: '#D9ECF1', 200: '#B5D9E3', 300: '#86BFCF', 400: '#4F9DB4',
          500: '#2C7F9A', 600: '#1F6883', 700: '#185369', 800: '#143F52', 900: '#0E2A3B',
        },
        ink: '#0E2A3B',
        saffron: { DEFAULT: '#F2A007', dark: '#B87400' },
        alarm: '#C8321E',
      },
    },
  },
  plugins: [],
}
export default config;
