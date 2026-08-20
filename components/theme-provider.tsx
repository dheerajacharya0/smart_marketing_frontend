"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

import { DEFAULT_THEME, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "@/lib/themes"

interface PaletteContextValue {
  /** Active palette family. */
  palette: ThemeId
  setPalette: (palette: ThemeId) => void
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
 * Inline script that applies the stored palette before first paint. Without it
 * the page renders one frame in the default palette and then snaps, which is
 * exactly the cheap-template feel the design is trying to avoid.
 */
export const paletteBootstrapScript = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    document.documentElement.setAttribute("data-theme", stored || ${JSON.stringify(DEFAULT_THEME)});
  } catch (e) {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
  }
})();
`.trim()

function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<ThemeId>(DEFAULT_THEME)

  // Adopt whatever the bootstrap script already put on <html>, so the first
  // client render agrees with the server-painted DOM.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme")
    if (isThemeId(current)) setPaletteState(current)
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

  const value = useMemo(() => ({ palette, setPalette }), [palette, setPalette])

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <PaletteProvider>{children}</PaletteProvider>
    </NextThemesProvider>
  )
}
