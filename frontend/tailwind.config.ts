import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EBF2F8',
          100: '#D6E4F0',
          600: '#1A5080',
          700: '#134170',
          800: '#0E3259',
          900: '#0A2342',
          950: '#061729',
        },
        ocean: {
          50: '#EAF5FA',
          100: '#D4EAF3',
          400: '#4A9BC4',
          500: '#2080AD',
          600: '#1B6B93',
          700: '#145578',
        },
        celadon: {
          50: '#F4FAF2',
          100: '#E8F5E4',
          500: '#B0D9A8',
          600: '#9DCE94',
          700: '#6BAF5E',
        },
        cream: {
          50: '#FDFAF1',
          100: '#FAF4E3',
          600: '#F4E8C1',
          700: '#C4A44E',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        stat: ['36px', { lineHeight: '1.1', fontWeight: '700' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(10, 35, 66, 0.05)',
        md: '0 4px 6px -1px rgba(10, 35, 66, 0.07), 0 2px 4px -2px rgba(10, 35, 66, 0.05)',
        lg: '0 10px 15px -3px rgba(10, 35, 66, 0.08), 0 4px 6px -4px rgba(10, 35, 66, 0.04)',
        xl: '0 20px 25px -5px rgba(10, 35, 66, 0.1), 0 8px 10px -6px rgba(10, 35, 66, 0.05)',
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
        topbar: '64px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
