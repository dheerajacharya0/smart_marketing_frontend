"use client"

import { useEffect } from "react"
import { installGlobalErrorHandlers } from "@/lib/observability"

/**
 * Installs global `unhandledrejection` / `error` listeners so silent async
 * failures reach the reporter (Phase 0 #2 / Phase E #7). Renders nothing.
 */
export function GlobalErrorHandlers() {
  useEffect(() => {
    installGlobalErrorHandlers()
  }, [])
  return null
}
