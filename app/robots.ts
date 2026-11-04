import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth flows and the gated dashboard have
        // nothing for a search index and shouldn't be crawled.
        disallow: [
          "/dashboard",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/invite",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
