/**
 * "Your brand" colour: one hex the customer picks, turned into the brand tokens
 * every palette defines (primary, its soft and emphasis steps, ring, sidebar
 * primary, and the vivid accent the gradients run into) — for light and dark.
 *
 * Only the brand tokens: neutrals, status colours and charts stay the chosen
 * palette's, so a garish pick can recolour the product's voice but never make
 * text unreadable or turn errors into the brand colour.
 *
 * The output is a stylesheet string. It is computed once when the colour is
 * picked and stored as-is, so the pre-paint bootstrap script only has to inject
 * it — no colour maths in an inline script.
 */

export const BRAND_COLOR_STORAGE_KEY = "app-brand-color"
export const BRAND_CSS_STORAGE_KEY = "app-brand-css"
export const BRAND_STYLE_ELEMENT_ID = "brand-color-tokens"

export interface Hsl {
  h: number
  s: number
  l: number
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
}

export function hexToHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** WCAG relative luminance of an HSL colour, 0 (black) to 1 (white). */
export function luminance({ h, s, l }: Hsl): number {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const channel = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(channel(0)) + 0.7152 * lin(channel(8)) + 0.0722 * lin(channel(4))
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const fmt = ({ h, s, l }: Hsl) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`

/** Text colour that stays readable on `bg`: white, or a near-black of its hue. */
function onColor(bg: Hsl): string {
  // 0.18 is where white and near-black give the same contrast; above it,
  // dark text reads better. White on anything lighter falls under 4.5:1.
  return luminance(bg) > 0.18 ? `${bg.h} 40% 8%` : "0 0% 100%"
}

export function brandTokens(hex: string): { light: Record<string, string>; dark: Record<string, string> } {
  const base = hexToHsl(hex)
  const h = base.h
  // A near-grey pick still needs some colour to read as a brand at all.
  const s = clamp(base.s, 35, 88)
  const accentHue = (h + 35) % 360

  const lightPrimary = { h, s, l: clamp(base.l, 34, 52) }
  const darkPrimary = { h, s: clamp(s + 6, 40, 92), l: clamp(base.l + 18, 58, 74) }

  const set = (primary: Hsl, dark: boolean) => {
    const emphasis = { h, s: primary.s, l: dark ? primary.l + 8 : primary.l - 10 }
    const soft = dark ? { h, s: Math.round(s * 0.45), l: 15 } : { h, s: clamp(s + 10, 40, 100), l: 95 }
    const accentVivid = { h: accentHue, s: clamp(s + 5, 45, 92), l: dark ? 58 : 44 }
    const on = onColor(primary)
    return {
      "--primary": fmt(primary),
      "--primary-soft": fmt(soft),
      "--primary-emphasis": fmt(emphasis),
      "--primary-foreground": on,
      "--ring": fmt(primary),
      "--sidebar-primary": fmt(primary),
      "--sidebar-primary-foreground": on,
      "--accent-vivid": fmt(accentVivid),
      "--chart-1": fmt(primary),
    }
  }
  return { light: set(lightPrimary, false), dark: set(darkPrimary, true) }
}

/**
 * The stylesheet for a brand colour. Selectors are doubled so they outrank every
 * palette block (`.dark[data-theme="…"]` is two classes' worth) without
 * `!important`, and only apply while `data-brand` is set on <html>.
 */
export function brandCss(hex: string): string {
  const { light, dark } = brandTokens(hex)
  const body = (tokens: Record<string, string>) =>
    Object.entries(tokens)
      .map(([k, v]) => `${k}:${v};`)
      .join("")
  return `html[data-brand][data-brand]{${body(light)}}html.dark[data-brand][data-brand]{${body(dark)}}`
}
