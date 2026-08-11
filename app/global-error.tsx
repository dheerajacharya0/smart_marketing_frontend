"use client"

import { useEffect } from "react"

// Catches errors in the root layout itself. Must render its own <html>/<body>
// because the root layout has failed. Kept dependency-free for that reason.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#111827",
          background: "#ffffff",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h2>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", maxWidth: "28rem", margin: 0 }}>
          A critical error occurred while loading the app. Please try again.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>Reference: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          style={{
            cursor: "pointer",
            borderRadius: "0.5rem",
            border: "none",
            background: "#25d366",
            color: "#ffffff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
