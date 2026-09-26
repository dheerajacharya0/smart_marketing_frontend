"use client"

import { useEffect } from "react"
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals"
import { reportMetric } from "@/lib/observability"

/**
 * Core Web Vitals reporting (Phase A.4). Reports CLS/INP/LCP/FCP/TTFB once per
 * page load, as Sentry breadcrumbs — see `reportMetric` for why not events.
 */
function handleMetric(metric: Metric) {
  if (process.env.NODE_ENV !== "production") return
  reportMetric({
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
