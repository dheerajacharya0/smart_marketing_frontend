import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { META_PRICING_CHECKED } from "@/lib/meta-pricing"
import { USE_CASE_GUIDES } from "@/lib/use-case-guides"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/whatsapp-api-pricing-india`,
      lastModified: new Date(META_PRICING_CHECKED.iso),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${SITE_URL}/use-cases`, lastModified: new Date(META_PRICING_CHECKED.iso), changeFrequency: "monthly", priority: 0.6 },
    ...USE_CASE_GUIDES.map((g) => ({
      url: `${SITE_URL}/use-cases/${g.slug}`,
      lastModified: new Date(META_PRICING_CHECKED.iso),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ]
}
