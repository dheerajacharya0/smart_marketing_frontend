import { ImageResponse } from "next/og"

/**
 * App icons, generated rather than checked in as PNGs so they can't drift from
 * the brand mark in components/auth/auth-shell.tsx.
 *
 * Needed for two things the site never had: installing to a phone's Home Screen
 * (the manifest points here; iOS will not offer Web Push to a site that isn't
 * installed) and the icon on a push notification. The Android status-bar badge
 * is app/notification-badge/route.tsx, not a size here — see why there.
 */

const BUBBLE = "M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Z"
const HANDSET =
  "M8.4 7.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.3 0 .6.3.5.8 1.1 1.4 1.6.8.6 1.4.8 1.7.9.2.1.4 0 .5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.3 0 .3 0 .9-.3 1.3-.3.4-1.1.9-1.6.9-1.4 0-3.3-.9-4.6-2.2-1.4-1.4-2.3-3.2-2.3-4.6 0-.5.3-1.2.6-1.6.1-.1.2-.3.4-.4Z"

const SIZES = { "192": 192, "512": 512 } as const

export function generateImageMetadata() {
  return Object.entries(SIZES).map(([id, size]) => ({
    id,
    size: { width: size, height: size },
    contentType: "image/png",
  }))
}

export default async function Icon({ id }: { id: Promise<string> | string }) {
  const key = (await id) as keyof typeof SIZES
  const size = SIZES[key] ?? 192

  // Full-bleed square: the OS applies its own mask (circle, squircle), and the
  // glyph sits inside the maskable safe zone (central 80%).
  const glyph = Math.round(size * 0.56)
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, hsl(214 62% 47%), hsl(199 58% 46%))",
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <path d={BUBBLE} fill="white" />
          <path d={HANDSET} fill="hsl(142 70% 45%)" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
