"use client"

import { useEffect } from "react"
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals"
import { reportError } from "@/lib/observability"

/**
 * Core Web Vitals reporting (Phase A.4). Reports CLS/INP/LCP/FCP/TTFB once per
 * page load. Today it funnels through the observability seam (console until a
 * sink is configured); point `handleMetric` at analytics/Sentry when wired.
 */
function handleMetric(metric: Metric) {
  if (process.env.NODE_ENV !== "production") return
  // Reuse the observability seam so there is a single reporting choke point.
  reportError(null, {
    source: "web-vitals",
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
  })
}

export function WebVitals() {
  useEffect(() => {
    onCLS(handleMetric)
    onINP(handleMetric)
    onLCP(handleMetric)
    onFCP(handleMetric)
    onTTFB(handleMetric)
  }, [])
  return null
}
