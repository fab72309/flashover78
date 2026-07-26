/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
          container: 'var(--primary-container)',
        },
        secondary: 'var(--secondary)',
        surface: {
          DEFAULT: 'var(--surface)',
          container: {
            DEFAULT: 'var(--surface-container)',
            low: 'var(--surface-container-low)',
            lowest: 'var(--surface-container-lowest)',
            high: 'var(--surface-container-high)',
            highest: 'var(--surface-container-highest)',
          },
        },
        'on-surface': {
          DEFAULT: 'var(--on-surface)',
          variant: 'var(--on-surface-variant)',
        },
        outline: {
          DEFAULT: 'var(--outline)',
          variant: 'var(--outline-variant)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '800' }],
        'display-md': ['2.75rem', { lineHeight: '1.1', letterSpacing: '0', fontWeight: '700' }],
        'display-sm': ['2rem', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '700' }],
        'headline-lg': ['1.75rem', { lineHeight: '1.3', letterSpacing: '0', fontWeight: '700' }],
        'headline-md': ['1.375rem', { lineHeight: '1.3', letterSpacing: '0', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label-lg': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      borderRadius: {
        'squircle': '1.25rem',
        'squircle-lg': '1.5rem',
        'squircle-sm': '0.875rem',
      },
      boxShadow: {
        'ambient': '0 8px 40px rgba(26, 28, 29, 0.06)',
        'ambient-lg': '0 12px 48px rgba(26, 28, 29, 0.08)',
        'ambient-sm': '0 4px 20px rgba(26, 28, 29, 0.04)',
        'glass': '0 8px 32px rgba(26, 28, 29, 0.06)',
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '18': '4.5rem',
      },
      backdropBlur: {
        'glass': '20px',
      },
    },
  },
  plugins: [],
};
