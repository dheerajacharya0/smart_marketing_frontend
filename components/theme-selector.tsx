"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react"

import { usePalette } from "@/components/theme-provider"
import { THEMES, type ThemeDefinition, type ThemePreview } from "@/lib/themes"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * A miniature of the interface in a given palette: page ground, a panel, a
 * primary action, an accent, and the hairline. Labels alone make seven themes
 * indistinguishable — the swatch is the actual decision aid.
 */
function ThemeSwatch({ preview, className }: { preview: ThemePreview; className?: string }) {
  return (
    <div
      className={cn("relative h-14 w-full overflow-hidden rounded-md", className)}
      style={{ background: preview.background, boxShadow: `inset 0 0 0 1px ${preview.border}` }}
      aria-hidden
    >
      {/* nav rail */}
      <div
        className="absolute inset-y-0 left-0 w-[22%]"
        style={{ background: preview.surface, borderRight: `1px solid ${preview.border}` }}
      />
      {/* panel */}
      <div
        className="absolute right-1.5 top-1.5 h-5 w-[62%] rounded-sm"
        style={{ background: preview.surface, boxShadow: `inset 0 0 0 1px ${preview.border}` }}
      />
      {/* primary action + accent dot */}
      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full" style={{ background: preview.accent }} />
        <span className="h-3.5 w-8 rounded-sm" style={{ background: preview.primary }} />
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  isDark,
  selected,
  onSelect,
}: {
  theme: ThemeDefinition
  isDark: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "focus-ring group relative rounded-lg border p-2 text-left transition-all duration-base ease-out-soft",
        selected
          ? "border-primary/50 bg-primary-soft/40 shadow-glow"
          : "border-border-subtle hover:border-border-strong hover:bg-accent/40",
      )}
    >
      <ThemeSwatch preview={isDark ? theme.dark : theme.light} />
      <div className="mt-2 flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{theme.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {theme.description}
          </p>
        </div>
        {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
      </div>
    </button>
  )
}

const MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/**
 * Theme control: palette family on one axis, light/dark/system on the other.
 * Both apply instantly and persist — the palette in localStorage via the
 * palette provider, the mode via next-themes.
 */
export function ThemeSelector({ className }: { className?: string }) {
  const { palette, setPalette } = usePalette()
  const { theme: mode, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Theme state only exists on the client; rendering it during hydration would
  // mismatch whatever the bootstrap script applied.
  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Change theme"
          className={cn("h-9 w-9 rounded-md", className)}
        >
          <Palette className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(92vw,26rem)] rounded-xl border-border-subtle p-0"
      >
        <div className="border-b border-border-subtle p-3">
          <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
            Appearance
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-muted/60 p-1">
            {MODES.map((m) => {
              const active = mounted && mode === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setTheme(m.value)}
                  aria-pressed={active}
                  className={cn(
                    "focus-ring flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors duration-fast ease-out-soft",
                    active
                      ? "bg-surface-2 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <m.icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="max-h-[min(60vh,26rem)] overflow-y-auto p-3">
          <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
            Theme
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isDark={isDark}
                selected={palette === theme.id}
                onSelect={() => setPalette(theme.id)}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Compact light/dark toggle for surfaces with no room for the full selector. */
export function ModeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("h-9 w-9 rounded-md", className)}
    >
      <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-transform duration-slow ease-spring dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-transform duration-slow ease-spring dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
