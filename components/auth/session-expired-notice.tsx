"use client"

import { useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"

/**
 * Shown when apiRequest bounces an expired/invalid session to /login?expired=1.
 * Reads a search param, so every use must sit inside a <Suspense> boundary —
 * useSearchParams without one crashes the production build in this app.
 */
export function SessionExpiredNotice() {
  const expired = useSearchParams().get("expired")
  if (!expired) return null

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>Your session expired. Please sign in again to continue.</span>
    </div>
  )
}
