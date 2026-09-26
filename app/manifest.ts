import type { MetadataRoute } from "next"

/**
 * Web app manifest. Makes the dashboard installable to a phone's Home Screen,
 * which on iPhone/iPad is a precondition for Web Push — Safari only exposes
 * PushManager to a site opened from the Home Screen. Opens straight into the
 * inbox, since that is what someone tapping the icon on a phone came for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wavelength",
    short_name: "Wavelength",
    description: "WhatsApp campaigns, a shared team inbox, and automation.",
    start_url: "/dashboard/chat",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2e73c2",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
