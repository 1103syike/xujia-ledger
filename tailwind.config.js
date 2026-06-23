/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  safelist: [{ pattern: /^deco-illustration--/ }],
  theme: {
    extend: {
      colors: {
        cream: 'var(--color-bg)',
        peach: 'var(--color-brand-peach)',
        mint: 'var(--color-brand-mint)',
        lavender: 'var(--color-brand-lavender)',
        coral: 'var(--color-link)',
        ink: 'var(--color-text)',
        positive: 'var(--color-positive)',
        debt: 'var(--color-debt)',
        primary: 'var(--color-action-primary)',
        surface: 'var(--color-surface)',
      },
      spacing: {
        'ds-1': 'var(--space-1)',
        'ds-2': 'var(--space-2)',
        'ds-3': 'var(--space-3)',
        'ds-4': 'var(--space-4)',
        'ds-6': 'var(--space-6)',
        'ds-8': 'var(--space-8)',
      },
      fontFamily: {
        sans: ['var(--font-family-sans)'],
        emoji: ['var(--font-family-emoji)'],
      },
      fontSize: {
        'ds-xs': ['var(--font-size-xs)', { lineHeight: 'var(--line-height-relaxed)' }],
        'ds-sm': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-relaxed)' }],
        'ds-base': ['var(--font-size-base)', { lineHeight: 'var(--line-height-normal)' }],
        'ds-lg': ['var(--font-size-lg)', { lineHeight: 'var(--line-height-tight)' }],
      },
      borderRadius: {
        'ds-sm': 'var(--radius-sm)',
        'ds-md': 'var(--radius-md)',
        'ds-lg': 'var(--radius-lg)',
        'ds-full': 'var(--radius-full)',
        xl: 'var(--radius-sm)',
        '2xl': 'var(--radius-md)',
        '3xl': 'var(--radius-lg)',
      },
      boxShadow: {
        'ds-0': 'var(--shadow-0)',
        'ds-1': 'var(--shadow-1)',
        'ds-2': 'var(--shadow-2)',
        sm: 'var(--shadow-1)',
        lg: 'var(--shadow-2)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      minHeight: {
        touch: 'var(--layout-touch-target)',
      },
      maxWidth: {
        app: 'var(--layout-max-width)',
      },
      zIndex: {
        header: 'var(--z-sticky-header)',
        submit: 'var(--z-submit-bar)',
        modal: 'var(--z-modal)',
        sheet: 'var(--z-sheet)',
      },
    },
  },
  plugins: [],
};
