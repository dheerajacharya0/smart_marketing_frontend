"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes"

import {
  DEFAULT_INTENSITY,
  DEFAULT_THEME,
  INTENSITY_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isIntensity,
  isThemeId,
  type Intensity,
  type ThemeId,
} from "@/lib/themes"
import {
  BRAND_COLOR_STORAGE_KEY,
  BRAND_CSS_STORAGE_KEY,
  BRAND_STYLE_ELEMENT_ID,
  brandCss,
  isHexColor,
} from "@/lib/brand-color"

interface PaletteContextValue {
  /** Active palette family. */
  palette: ThemeId
  setPalette: (palette: ThemeId) => void
  /** Calm or vivid — how strongly the palette is expressed. */
  intensity: Intensity
  setIntensity: (intensity: Intensity) => void
  /** "Your brand" colour laid over the palette's brand tokens, or null for none. */
  brandColor: string | null
  setBrandColor: (hex: string | null) => void
}

const PaletteContext = createContext<PaletteContextValue | null>(null)

/**
 * The palette family (Calm Blue, Sage, …). Independent of light/dark, which
 * next-themes owns — the two compose, so every family works in both modes.
 */
export function usePalette() {
  const ctx = useContext(PaletteContext)
  if (!ctx) throw new Error("usePalette must be used inside <ThemeProvider>")
  return ctx
}

/**
 * Inline script that applies the stored palette and intensity before first paint. Without it
 * the page renders one frame in the default palette and then snaps, which is
 * exactly the cheap-template feel the design is trying to avoid.
 */
export const paletteBootstrapScript = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var intensity = localStorage.getItem(${JSON.stringify(INTENSITY_STORAGE_KEY)});
    document.documentElement.setAttribute("data-theme", stored || ${JSON.stringify(DEFAULT_THEME)});
    document.documentElement.setAttribute("data-intensity", intensity || ${JSON.stringify(DEFAULT_INTENSITY)});
    var brandCss = localStorage.getItem(${JSON.stringify(BRAND_CSS_STORAGE_KEY)});
    if (brandCss) {
      var style = document.createElement("style");
      style.id = ${JSON.stringify(BRAND_STYLE_ELEMENT_ID)};
      style.textContent = brandCss;
      document.head.appendChild(style);
      document.documentElement.setAttribute("data-brand", "");
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
    document.documentElement.setAttribute("data-intensity", ${JSON.stringify(DEFAULT_INTENSITY)});
  }
})();
`.trim()

function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<ThemeId>(DEFAULT_THEME)
  const [intensity, setIntensityState] = useState<Intensity>(DEFAULT_INTENSITY)
  const [brandColor, setBrandColorState] = useState<string | null>(null)

  // Adopt whatever the bootstrap script already put on <html>, so the first
  // client render agrees with the server-painted DOM.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme")
    if (isThemeId(current)) setPaletteState(current)
    const currentIntensity = document.documentElement.getAttribute("data-intensity")
    if (isIntensity(currentIntensity)) setIntensityState(currentIntensity)
    try {
      const stored = localStorage.getItem(BRAND_COLOR_STORAGE_KEY)
      if (isHexColor(stored)) setBrandColorState(stored)
    } catch {
      // No storage, no saved brand colour.
    }
  }, [])

  const setPalette = useCallback((next: ThemeId) => {
    const root = document.documentElement

    // Colour-only crossfade while the tokens swap. The class is removed once
    // the transition is done so it never interferes with component animation.
    root.classList.add("theme-transition")
    root.setAttribute("data-theme", next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). The theme
      // still applies for this session; only persistence is lost.
    }
    setPaletteState(next)

    window.setTimeout(() => root.classList.remove("theme-transition"), 320)
  }, [])

  const setIntensity = useCallback((next: Intensity) => {
    const root = document.documentElement
    root.classList.add("theme-transition")
    root.setAttribute("data-intensity", next)
    try {
      localStorage.setItem(INTENSITY_STORAGE_KEY, next)
    } catch {
      // Same as the palette: applies now, just isn't remembered.
    }
    setIntensityState(next)
    window.setTimeout(() => root.classList.remove("theme-transition"), 320)
  }, [])

  const setBrandColor = useCallback((hex: string | null) => {
    const root = document.documentElement
    root.classList.add("theme-transition")
    document.getElementById(BRAND_STYLE_ELEMENT_ID)?.remove()
    if (hex && isHexColor(hex)) {
      const css = brandCss(hex)
      const style = document.createElement("style")
      style.id = BRAND_STYLE_ELEMENT_ID
      style.textContent = css
      document.head.appendChild(style)
      root.setAttribute("data-brand", "")
      try {
        localStorage.setItem(BRAND_COLOR_STORAGE_KEY, hex)
        // The generated sheet, stored as-is: the bootstrap script injects it
        // before first paint without needing any colour maths of its own.
        localStorage.setItem(BRAND_CSS_STORAGE_KEY, css)
      } catch {
        // Applies for this session only.
      }
      setBrandColorState(hex)
    } else {
      root.removeAttribute("data-brand")
      try {
        localStorage.removeItem(BRAND_COLOR_STORAGE_KEY)
        localStorage.removeItem(BRAND_CSS_STORAGE_KEY)
      } catch {
        // Nothing stored to clear.
      }
      setBrandColorState(null)
    }
    window.setTimeout(() => root.classList.remove("theme-transition"), 320)
  }, [])

  const value = useMemo(
    () => ({ palette, setPalette, intensity, setIntensity, brandColor, setBrandColor }),
    [palette, setPalette, intensity, setIntensity, brandColor, setBrandColor],
  )

  return (
    <PaletteContext.Provider value={value}>
      <ThemeColorSync palette={palette} />
      {children}
    </PaletteContext.Provider>
  )
}

/**
 * Keeps `<meta name="theme-color">` on the page background, so Android Chrome's
 * address bar and the installed app's status bar read as part of the app
 * instead of a white strip over a dark theme. Reads the resolved token rather
 * than a table of hex values, so a new palette needs nothing here.
 */
function ThemeColorSync({ palette }: { palette: ThemeId }) {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    // One frame late on purpose: this effect runs before next-themes' own
    // (children before parents), so the .dark class may not be on <html> yet.
    const frame = requestAnimationFrame(() => {
      const background = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim()
      if (!background) return
      // Next renders its own tag from the `viewport` export; update that one
      // rather than adding a second, which browsers resolve inconsistently.
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (!meta) {
        meta = document.createElement("meta")
        meta.name = "theme-color"
        document.head.appendChild(meta)
      }
      meta.content = `hsl(${background})`
    })
    return () => cancelAnimationFrame(frame)
  }, [palette, resolvedTheme])
  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <PaletteProvider>{children}</PaletteProvider>
    </NextThemesProvider>
  )
}
