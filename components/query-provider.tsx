"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * TanStack Query provider (Phase A.1). Wraps the app so pages can migrate off
 * hand-rolled `useState + fetch` to typed query/mutation hooks — request dedup,
 * caching, stale-while-revalidate, retries, cancellation for free. Migration is
 * page-by-page; the old fetch path keeps working until a page is converted.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Sensible defaults for a dashboard: don't refetch on every focus,
            // keep data briefly fresh, retry transient failures once.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
