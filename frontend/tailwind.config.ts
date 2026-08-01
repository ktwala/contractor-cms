import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: 'var(--sidebar-bg)',
          border: 'var(--sidebar-border)',
          text: 'var(--sidebar-text)',
          muted: 'var(--sidebar-muted)',
          active: 'var(--sidebar-active-bg)',
          'active-border': 'var(--sidebar-active-border)',
        },
        brand: {
          DEFAULT: 'var(--brand-purple)',
          dark: 'var(--brand-purple-dark)',
        },
        page: 'var(--page-bg)',
        card: {
          DEFAULT: 'var(--card-bg)',
          border: 'var(--card-border)',
        },
        content: {
          DEFAULT: 'var(--text-main)',
          muted: 'var(--text-muted)',
        },
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        /* Primary scale → purple (legacy `primary-*` classes stay on-brand) */
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#5b3fd6',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      ringColor: {
        focus: 'var(--sidebar-active-border)',
      },
    },
  },
  plugins: [],
};

export default config;
