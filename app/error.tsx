"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO(Phase 0 #2): report to Sentry once wired.
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. You can retry, or head back and try again.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70">Reference: {error.digest}</p>
        ) : null}
      </div>
      <Button onClick={reset} className="gap-2">
        <RotateCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  )
}
