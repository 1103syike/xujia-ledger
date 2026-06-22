/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  safelist: [{ pattern: /^deco-illustration--/ }],
  theme: {
    extend: {
      colors: {
        cream: 'var(--theme-cream)',
        peach: 'var(--theme-peach)',
        mint: 'var(--theme-mint)',
        lavender: 'var(--theme-lavender)',
        coral: 'var(--theme-coral)',
        ink: 'var(--theme-ink)',
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
