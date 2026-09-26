import { ImageResponse } from "next/og"

/** Home Screen icon for iPhone/iPad. Same mark as app/icon.tsx; iOS rounds the corners itself. */

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
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
        <svg width={104} height={104} viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Z" fill="white" />
          <path
            d="M8.4 7.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.3 0 .6.3.5.8 1.1 1.4 1.6.8.6 1.4.8 1.7.9.2.1.4 0 .5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.2.3.3 0 .3 0 .9-.3 1.3-.3.4-1.1.9-1.6.9-1.4 0-3.3-.9-4.6-2.2-1.4-1.4-2.3-3.2-2.3-4.6 0-.5.3-1.2.6-1.6.1-.1.2-.3.4-.4Z"
            fill="hsl(142 70% 45%)"
          />
        </svg>
      </div>
    ),
    size,
  )
}
