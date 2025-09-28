import defaultTheme from 'tailwindcss/defaultTheme';

const charcoalBase = {
  900: '#0c0c0f',
  800: '#121218',
  700: '#16161d',
  600: '#1d1d27',
  500: '#272736',
};

export default {
  darkMode: 'class',
  content: ['./public/**/*.{html,js}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#ff339e',
        secondary: '#f8f7f7',
        tertiary: '#f53d9d',
        quaternary: '#ebccff',
        quinary: '#ec99ff',
        charcoal: charcoalBase,
        accent: {
          mint: '#66fbd1',
          cyan: '#24d9f4',
        },
      },
      boxShadow: {
        'neon-pink': '0 0 25px rgba(255, 51, 158, 0.35)',
        'neon-cyan': '0 0 30px rgba(36, 217, 244, 0.35)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', ...defaultTheme.fontFamily.sans],
        mono: ['"Fira Code"', ...defaultTheme.fontFamily.mono],
      },
      backgroundImage: {
        noise:
          "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"140\" height=\"140\" viewBox=\"0 0 140 140\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"140\" height=\"140\" filter=\"url(%23n)\" opacity=\"0.08\"/></svg>')",
      },
      backdropBlur: {
        halo: '18px',
      },
    },
  },
  plugins: [],
};
