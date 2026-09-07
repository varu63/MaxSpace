/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ============================================================
           MaxSpace Design System (single source of truth)
           Cream / Navy / Gold theme used across every page.
        ============================================================ */
        page: '#F8F2DE',        // page background
        surface: '#FFFDF8',     // card / panel background
        soft: '#F5F1E7',        // info rows, inputs, sub-headers
        line: {
          DEFAULT: '#EEE9DA',   // card borders & dividers
          soft: '#E7E1D3',      // input / soft-row borders
        },
        brand: {
          DEFAULT: '#173B5C',   // primary navy (buttons, icons, active)
          dark: '#102F4A',      // primary hover
        },
        ink: {
          DEFAULT: '#16263A',   // primary text / headings
          muted: '#747B83',     // secondary text
          faint: '#8A9096',     // tertiary icons / placeholders
        },
        gold: {
          DEFAULT: '#B48611',   // accent (icons, outlines, highlights)
          muted: '#8A7A4A',     // muted gold text
          deep: '#9A8240',      // gold section headings
          dark: '#A77A08',      // text on gold-soft chips
          soft: '#FBF1C9',      // gold chip / callout background
          line: '#F0E6C8',      // gold callout border
          frame: '#D4C9A0',     // gold framing border (passport summary)
        },
        /* Status palette (semantic, not theme accents) */
        yellow: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
    },
  },
  plugins: [],
}