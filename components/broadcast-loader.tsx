import { cn } from "@/lib/utils"

/**
 * The product's loader: a megaphone sending out signal waves — a broadcast in
 * progress, which is what this product does. For whole-area waits (an editor or
 * detail page resolving). Content-shaped waits keep their skeletons, which read
 * as faster than any spinner; small inline waits keep the spinner icon.
 *
 * Colours are theme tokens; motion stops under prefers-reduced-motion (see
 * `.broadcast-wave` in globals.css), leaving a still megaphone and label.
 */
export function BroadcastLoader({
  label = "Loading…",
  size = "md",
  className,
}: {
  label?: string | null
  size?: "sm" | "md"
  className?: string
}) {
  const px = size === "sm" ? 40 : 64
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-3", className)}>
      <svg width={px} height={px} viewBox="0 0 64 64" fill="none" aria-hidden className="overflow-visible">
        <defs>
          <linearGradient id="broadcast-body" x1="8" y1="20" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--primary))" />
            <stop offset="1" stopColor="hsl(var(--accent-vivid))" />
          </linearGradient>
        </defs>
        {/* Signal waves, outermost last so they read as travelling outward. */}
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${44 + i * 6} ${22 - i * 4}q${6 + i * 2} ${10 + i * 4} 0 ${20 + i * 8}`}
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
            className="broadcast-wave"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
        {/* Megaphone: bell, body, handle. */}
        <path d="M14 26h8l18-10v32L22 38h-8a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z" fill="url(#broadcast-body)" />
        <path d="M18 38l3 10a3 3 0 0 0 3 2h2a2 2 0 0 0 2-2.5L26 38" fill="hsl(var(--primary) / 0.55)" />
      </svg>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}
