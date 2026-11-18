import { ImageResponse } from "next/og"

// The share card for converszio.com, and the fallback for every route without
// its own. It is what a link previews as on WhatsApp, LinkedIn and X, and the
// landing page's "send this to a business" button shares exactly this URL.
// Rendered once at build time. Plain ASCII only: the bundled default font has
// no ₹ glyph, so prices stay out of the image.

export const alt = "Converszio: WhatsApp marketing with zero markup on Meta"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #f7fafd 0%, #e8f0fe 55%, #dff7f1 100%)",
          color: "#0b1220",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700, color: "#2563eb" }}>
          Converszio
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 980 }}>
            WhatsApp campaigns, follow-ups and one team inbox.
          </div>
          <div style={{ marginTop: 28, fontSize: 36, color: "#334155", maxWidth: 980 }}>
            Meta bills you at its own rate. We add 0% on top.
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, fontSize: 28 }}>
          {["0% markup", "Unlimited seats", "30-day free trial"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "12px 26px",
                borderRadius: 999,
                background: "#ffffff",
                border: "2px solid #c7d7fe",
                color: "#1e3a8a",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
