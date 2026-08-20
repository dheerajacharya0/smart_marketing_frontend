import type { ElementType, HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

type SurfaceTier = "base" | "raised" | "elevated" | "soft" | "highlight" | "glass" | "float"

const TIER_CLASS: Record<SurfaceTier, string> = {
  base: "surface-base",
  raised: "surface-raised",
  elevated: "surface-elevated",
  soft: "surface-soft",
  highlight: "surface-highlight",
  glass: "surface-glass",
  float: "surface-float",
}

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation tier. See `.surface-*` in globals.css for what each one means. */
  tier?: SurfaceTier
  /** Adds the hover lift. Clickable panels only. */
  interactive?: boolean
  /** Signal glow — reserved for live/active/selected, never decoration. */
  active?: boolean
  as?: ElementType
  children?: ReactNode
}

/**
 * The surface primitive. Depth is tone + hairline + soft shadow; only the
 * `glass` and `float` tiers actually blur, and both fall back to an opaque
 * fill on phones and under reduced transparency.
 */
export function GlassPanel({
  tier = "raised",
  interactive,
  active,
  as: Tag = "div",
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <Tag
      className={cn(
        TIER_CLASS[tier],
        interactive && "surface-interactive",
        active && "signal-glow",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

/**
 * Ambient light for hero zones, auth, and empty states. Capped by the palette's
 * `--ambient-opacity` (zero on High Contrast), dropped under `sm` and on
 * reduced transparency. Place inside a `relative` container; content sits at
 * `relative z-10`.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  return <div aria-hidden className={cn("aurora-backdrop", className)} />
}

/** The WhatsApp chat wallpaper, at 3–4%. Inbox panes and empty states only. */
export function DoodleBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 doodle-wallpaper", className)} />
  )
}

/**
 * Page-level atmosphere: three very low-contrast washes plus fine grain that
 * stops the gradients banding. Fixed behind everything; content in the app
 * shell sits above it.
 */
export function AppBackground({ className }: { className?: string }) {
  return (
    <>
      <div aria-hidden className={cn("app-ambient", className)} />
      <div aria-hidden className="app-noise" />
    </>
  )
}
