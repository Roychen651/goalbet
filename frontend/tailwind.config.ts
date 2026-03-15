import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        'bg-base': '#0a0a0f',
        'bg-surface': 'rgba(255,255,255,0.03)',
        'bg-card': 'rgba(255,255,255,0.06)',
        'accent-green': '#00ff87',
        'accent-orange': '#ff6b35',
        'text-primary': '#ffffff',
        'text-muted': 'rgba(255,255,255,0.5)',
        'border-subtle': 'rgba(255,255,255,0.08)',
        'border-bright': 'rgba(255,255,255,0.15)',
      },
      fontFamily: {
        bebas: ['"Bebas Neue"', 'sans-serif'],
        dm: ['"DM Sans"', 'sans-serif'],
      },
      backgroundImage: {
        'glow-green': 'radial-gradient(ellipse at center, rgba(0,255,135,0.15) 0%, transparent 70%)',
        'glow-orange': 'radial-gradient(ellipse at center, rgba(255,107,53,0.15) 0%, transparent 70%)',
        'stadium-noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0,255,135,0.3), 0 0 40px rgba(0,255,135,0.1)',
        'glow-orange': '0 0 20px rgba(255,107,53,0.3), 0 0 40px rgba(255,107,53,0.1)',
        'glow-green-sm': '0 0 10px rgba(0,255,135,0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'score-pop': 'scorePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'rank-up': 'rankUp 0.5s ease-out',
        'rank-down': 'rankDown 0.5s ease-out',
        'live-pulse': 'livePulse 1.5s ease-in-out infinite',
        // New cinematic animations
        'float': 'float 8s ease-in-out infinite',
        'float-delayed': 'float 10s ease-in-out infinite 3s',
        'float-slow': 'float 14s ease-in-out infinite 6s',
        'orb-drift': 'orbDrift 20s ease-in-out infinite',
        'orb-drift-rev': 'orbDriftRev 25s ease-in-out infinite',
        'beam': 'beam 4s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'rise': 'rise 6s linear infinite',
        'rise-delayed': 'rise 8s linear infinite 2s',
        'rise-slow': 'rise 12s linear infinite 4s',
        'spin-slow': 'spin 20s linear infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,255,135,0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0,255,135,0.5), 0 0 60px rgba(0,255,135,0.2)' },
        },
        scorePop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        rankUp: {
          '0%': { transform: 'translateY(8px)', color: 'rgba(0,255,135,1)' },
          '100%': { transform: 'translateY(0)', color: 'inherit' },
        },
        rankDown: {
          '0%': { transform: 'translateY(-8px)', color: 'rgba(255,107,53,1)' },
          '100%': { transform: 'translateY(0)', color: 'inherit' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-24px)' },
        },
        orbDrift: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '25%': { transform: 'translate(60px, -40px) scale(1.05)' },
          '50%': { transform: 'translate(20px, -80px) scale(0.95)' },
          '75%': { transform: 'translate(-40px, -30px) scale(1.02)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        orbDriftRev: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '25%': { transform: 'translate(-50px, 30px) scale(0.98)' },
          '50%': { transform: 'translate(-80px, 60px) scale(1.04)' },
          '75%': { transform: 'translate(30px, 40px) scale(0.96)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        beam: {
          '0%, 100%': { opacity: '0.3', transform: 'scaleY(1)' },
          '50%': { opacity: '0.7', transform: 'scaleY(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        rise: {
          '0%': { transform: 'translateY(100vh)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-20vh)', opacity: '0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
