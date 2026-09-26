/**
 * A short confetti burst for real milestones — setup finished, first message
 * sent. Plain DOM + Web Animations, no library: ~40 small elements that remove
 * themselves after about a second, drawn in the active theme's own colours.
 *
 * Skipped entirely under prefers-reduced-motion; the caller's toast still says
 * what happened.
 */
export function celebrate() {
  if (typeof window === "undefined") return
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

  const tokens = ["--primary", "--accent-vivid", "--secondary-vivid", "--success", "--warning"]
  const root = getComputedStyle(document.documentElement)
  const colours = tokens
    .map((t) => root.getPropertyValue(t).trim())
    .filter(Boolean)
    .map((v) => `hsl(${v})`)
  if (colours.length === 0) return

  const layer = document.createElement("div")
  layer.setAttribute("aria-hidden", "true")
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "100",
    overflow: "hidden",
  })
  document.body.appendChild(layer)

  const originX = window.innerWidth / 2
  const originY = window.innerHeight * 0.35
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("span")
    const size = 5 + Math.random() * 5
    Object.assign(piece.style, {
      position: "absolute",
      left: `${originX}px`,
      top: `${originY}px`,
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 0.45)}px`,
      background: colours[i % colours.length],
      borderRadius: Math.random() > 0.6 ? "999px" : "2px",
    })
    layer.appendChild(piece)
    const angle = Math.random() * Math.PI * 2
    const distance = 90 + Math.random() * 160
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 60
    piece.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 180}px) rotate(${Math.random() * 540}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    )
  }
  window.setTimeout(() => layer.remove(), 1600)
}
