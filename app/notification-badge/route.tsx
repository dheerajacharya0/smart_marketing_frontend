import { ImageResponse } from "next/og"

/**
 * The small status-bar glyph on an Android push notification (public/sw.js).
 * Android draws it from the alpha channel only, so it is a white silhouette on
 * transparent. A route rather than a size in app/icon.tsx because every size
 * there becomes a <link rel="icon">, and the browser could pick this one as the
 * tab icon — white on a light tab, i.e. invisible.
 */
export function GET() {
  return new ImageResponse(
    (
      <svg width={96} height={96} viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Z" fill="white" />
      </svg>
    ),
    { width: 96, height: 96 },
  )
}
