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
            // Outlive the 5-minute default. `staleTime` decides when to
            // revalidate; `gcTime` decides whether there is anything to paint
            // while that happens. At the default, a section revisited six
            // minutes later had been evicted and came back as an empty skeleton
            // — the same "slow first navigation" the user sees on a cold load,
            // repeated for the rest of the session. Half an hour of retention
            // costs a few list responses of memory and makes every return trip
            // render instantly, then refresh underneath.
            gcTime: 30 * 60_000,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
