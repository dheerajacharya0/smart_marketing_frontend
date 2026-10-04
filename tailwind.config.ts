import type { Config } from "tailwindcss"

/**
 * Every value here resolves to a CSS custom property defined in
 * app/globals.css. Nothing in this file hardcodes a colour, radius, shadow or
 * duration — swapping the active palette (`data-theme` on <html>) or the mode
 * (`.dark`) restyles the whole application through these tokens.
 */
const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "1.4" }],
        sm: ["var(--text-sm)", { lineHeight: "1.5" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-body)" }],
        lg: ["var(--text-lg)", { lineHeight: "1.5" }],
        xl: ["var(--text-xl)", { lineHeight: "1.35" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-tight)" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
      },
      letterSpacing: {
        display: "var(--tracking-display)",
        tight: "var(--tracking-tight)",
        label: "var(--tracking-label)",
      },
      colors: {
        // Landing page only (app/landing.css) — its own light/dark tokens,
        // independent of the dashboard palette.
        lp: {
          bg: "var(--lp-bg)",
          fg: "var(--lp-fg)",
          text: "var(--lp-text)",
          muted: "var(--lp-muted)",
          subtle: "var(--lp-subtle)",
          line: "var(--lp-line)",
          "line-strong": "var(--lp-line-strong)",
          card: "var(--lp-card)",
          "card-hover": "var(--lp-card-hover)",
          elev: "var(--lp-elev)",
          nav: "var(--lp-nav)",
          accent: "var(--lp-accent)",
          "accent-soft": "var(--lp-accent-soft)",
          "accent-line": "var(--lp-accent-line)",
          input: "var(--lp-input)",
        },
        // Structure
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "foreground-secondary": "hsl(var(--foreground-secondary))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          2: "hsl(var(--surface-2))",
        },
        border: "hsl(var(--border))",
        "border-subtle": "hsl(var(--border-subtle))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        highlight: "hsl(var(--highlight))",

        // Brand
        primary: {
          DEFAULT: "hsl(var(--primary))",
          soft: "hsl(var(--primary-soft))",
          emphasis: "hsl(var(--primary-emphasis))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          vivid: "hsl(var(--secondary-vivid))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          vivid: "hsl(var(--accent-vivid))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Status
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          soft: "hsl(var(--warning-soft))",
          foreground: "hsl(var(--warning-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          soft: "hsl(var(--destructive-soft))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          soft: "hsl(var(--info-soft))",
          foreground: "hsl(var(--info-foreground))",
        },

        // Navigation
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          "muted-foreground": "hsl(var(--sidebar-muted-foreground))",
        },

        // Data visualisation — palettes are defined per theme
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },

        // WhatsApp brand accents and the delivery-tick language
        whatsapp: {
          DEFAULT: "hsl(var(--whatsapp))",
          dark: "hsl(var(--whatsapp-dark))",
        },
        facebook: "hsl(var(--facebook))",
        tick: {
          queued: "hsl(var(--tick-queued))",
          sent: "hsl(var(--tick-sent))",
          delivered: "hsl(var(--tick-delivered))",
          read: "hsl(var(--tick-read))",
          done: "hsl(var(--tick-done))",
          failed: "hsl(var(--tick-failed))",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        float: "var(--radius-float)",
        bubble: "var(--radius-bubble)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        inset: "var(--shadow-inset)",
        glow: "var(--glow-primary)",
        focus: "var(--glow-focus)",
      },
      transitionTimingFunction: {
        "out-soft": "var(--ease-out-soft)",
        spring: "var(--ease-spring)",
        "in-out-soft": "var(--ease-in-out-soft)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent-vivid)))",
        "surface-sheen": "linear-gradient(180deg, hsl(var(--highlight) / 0.06), transparent 40%)",
      },
      keyframes: {
        "signal-rise": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "signal-rise": "signal-rise var(--duration-slow) var(--ease-out-soft) both",
        "accordion-down": "accordion-down var(--duration-base) var(--ease-out-soft)",
        "accordion-up": "accordion-up var(--duration-base) var(--ease-out-soft)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
