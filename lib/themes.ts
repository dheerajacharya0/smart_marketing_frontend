/**
 * The palette families the product ships with. Each one is defined in
 * app/globals.css as a `[data-theme="…"]` block (light) plus a
 * `.dark[data-theme="…"]` block (dark) — this file is only the registry the UI
 * reads for names, descriptions, and swatch previews.
 *
 * Swatch values are duplicated here on purpose: the preview has to paint a
 * theme that is *not* currently applied, so it cannot read the live custom
 * properties. Keep them in sync with globals.css when a palette is retuned.
 */

export type ThemeId =
  | "calm-blue"
  | "sage"
  | "lavender"
  | "ocean"
  | "warm-sand"
  | "midnight"
  | "aurora"
  | "neon-mint"
  | "sunrise"
  | "high-contrast"

export interface ThemePreview {
  /** Page ground. */
  background: string
  /** Card / panel tone. */
  surface: string
  /** Primary action colour. */
  primary: string
  /** Secondary accent used in charts and illustration. */
  accent: string
  /** Hairline colour, so previews show the border weight too. */
  border: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  light: ThemePreview
  dark: ThemePreview
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "calm-blue",
    name: "Calm Blue",
    description: "Soft blue and misty white. Professional and trustworthy.",
    light: {
      background: "hsl(208 42% 98%)",
      surface: "hsl(210 40% 99%)",
      primary: "hsl(214 62% 47%)",
      accent: "hsl(199 58% 46%)",
      border: "hsl(214 24% 89%)",
    },
    dark: {
      background: "hsl(219 34% 8%)",
      surface: "hsl(219 28% 12%)",
      primary: "hsl(213 66% 62%)",
      accent: "hsl(194 52% 58%)",
      border: "hsl(218 20% 22%)",
    },
  },
  {
    id: "sage",
    name: "Sage",
    description: "Sage green on warm ivory. Natural and relaxing.",
    light: {
      background: "hsl(48 30% 97%)",
      surface: "hsl(46 34% 98%)",
      primary: "hsl(152 32% 35%)",
      accent: "hsl(168 28% 42%)",
      border: "hsl(56 15% 87%)",
    },
    dark: {
      background: "hsl(156 18% 7%)",
      surface: "hsl(156 14% 11%)",
      primary: "hsl(152 38% 52%)",
      accent: "hsl(168 34% 52%)",
      border: "hsl(156 10% 21%)",
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Muted violet on cool neutrals. Creative and sophisticated.",
    light: {
      background: "hsl(270 32% 98%)",
      surface: "hsl(268 34% 99%)",
      primary: "hsl(262 36% 54%)",
      accent: "hsl(292 34% 56%)",
      border: "hsl(268 20% 89%)",
    },
    dark: {
      background: "hsl(265 24% 9%)",
      surface: "hsl(265 20% 13%)",
      primary: "hsl(262 52% 72%)",
      accent: "hsl(292 42% 68%)",
      border: "hsl(265 14% 23%)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep teal and soft cyan. Premium technology feel.",
    light: {
      background: "hsl(192 34% 97%)",
      surface: "hsl(190 36% 98%)",
      primary: "hsl(187 52% 32%)",
      accent: "hsl(192 50% 44%)",
      border: "hsl(192 22% 87%)",
    },
    dark: {
      background: "hsl(196 34% 7%)",
      surface: "hsl(196 28% 11%)",
      primary: "hsl(184 54% 52%)",
      accent: "hsl(192 48% 58%)",
      border: "hsl(196 18% 21%)",
    },
  },
  {
    id: "warm-sand",
    name: "Warm Sand",
    description: "Cream and beige with terracotta. Elegant and comfortable.",
    light: {
      background: "hsl(36 42% 97%)",
      surface: "hsl(34 44% 98%)",
      primary: "hsl(18 44% 45%)",
      accent: "hsl(32 42% 50%)",
      border: "hsl(34 20% 86%)",
    },
    dark: {
      background: "hsl(26 16% 8%)",
      surface: "hsl(26 14% 12%)",
      primary: "hsl(20 52% 60%)",
      accent: "hsl(32 48% 60%)",
      border: "hsl(26 11% 22%)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Charcoal and navy lit by soft teal. Built for dark mode.",
    light: {
      background: "hsl(212 20% 97%)",
      surface: "hsl(212 22% 98%)",
      primary: "hsl(190 44% 33%)",
      accent: "hsl(198 42% 44%)",
      border: "hsl(212 14% 87%)",
    },
    dark: {
      background: "hsl(218 30% 6%)",
      surface: "hsl(218 26% 10%)",
      primary: "hsl(186 52% 52%)",
      accent: "hsl(198 46% 58%)",
      border: "hsl(218 16% 19%)",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Electric violet with cyan and magenta light. Futuristic.",
    light: {
      background: "hsl(250 36% 98%)",
      surface: "hsl(250 34% 99%)",
      primary: "hsl(262 70% 55%)",
      accent: "hsl(190 86% 42%)",
      border: "hsl(250 20% 88%)",
    },
    dark: {
      background: "hsl(252 32% 5%)",
      surface: "hsl(252 28% 8%)",
      primary: "hsl(262 88% 72%)",
      accent: "hsl(188 92% 58%)",
      border: "hsl(252 20% 18%)",
    },
  },
  {
    id: "neon-mint",
    name: "Neon Mint",
    description: "WhatsApp-bright emerald, near-black at night. Energetic.",
    light: {
      background: "hsl(160 32% 98%)",
      surface: "hsl(160 30% 99%)",
      primary: "hsl(158 76% 32%)",
      accent: "hsl(172 82% 38%)",
      border: "hsl(160 16% 88%)",
    },
    dark: {
      background: "hsl(160 24% 5%)",
      surface: "hsl(160 20% 8%)",
      primary: "hsl(152 82% 52%)",
      accent: "hsl(172 88% 50%)",
      border: "hsl(160 12% 18%)",
    },
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Warm coral and amber. Bright and optimistic.",
    light: {
      background: "hsl(28 42% 98%)",
      surface: "hsl(28 40% 99%)",
      primary: "hsl(12 78% 50%)",
      accent: "hsl(36 92% 48%)",
      border: "hsl(28 26% 88%)",
    },
    dark: {
      background: "hsl(20 28% 5%)",
      surface: "hsl(20 24% 8%)",
      primary: "hsl(16 92% 64%)",
      accent: "hsl(38 96% 60%)",
      border: "hsl(20 16% 18%)",
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Maximum readability and hard focus states. Accessibility first.",
    light: {
      background: "hsl(0 0% 100%)",
      surface: "hsl(0 0% 100%)",
      primary: "hsl(220 92% 32%)",
      accent: "hsl(146 92% 20%)",
      border: "hsl(0 0% 46%)",
    },
    dark: {
      background: "hsl(0 0% 5%)",
      surface: "hsl(0 0% 8%)",
      primary: "hsl(205 96% 70%)",
      accent: "hsl(146 76% 62%)",
      border: "hsl(0 0% 56%)",
    },
  },
]

export const DEFAULT_THEME: ThemeId = "calm-blue"

export const THEME_STORAGE_KEY = "app-palette"

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value)
}

/**
 * How loudly a palette is expressed — a second axis, independent of the family
 * and of light/dark. `vivid` adds gradient primary actions, a stronger ambient
 * wash and brand-tinted edges; `calm` is the restrained original. Applied as
 * `data-intensity` on <html>, styled in globals.css ("Vivid intensity").
 */
export type Intensity = "calm" | "vivid"

export const DEFAULT_INTENSITY: Intensity = "vivid"

export const INTENSITY_STORAGE_KEY = "app-intensity"

export function isIntensity(value: unknown): value is Intensity {
  return value === "calm" || value === "vivid"
}

export function themeById(id: string | undefined | null): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
