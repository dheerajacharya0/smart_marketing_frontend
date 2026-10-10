import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth flows, the gated dashboard and the team-only access page have
        // nothing for a search index and shouldn't be crawled.
        disallow: [
          "/dashboard",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/invite",
          "/early-access",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
