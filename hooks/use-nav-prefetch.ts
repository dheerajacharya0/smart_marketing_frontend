"use client"

import { useCallback } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  listAutomationRules,
  listCampaigns,
  listContacts,
  listDrips,
  listFlows,
  listSegments,
  listWhatsappFlows,
} from "@/services/api"
import { CONTACTS_PAGE_SIZE, queryKeys } from "@/hooks/use-queries"

/**
 * Warms a section's first request the moment the user shows intent to go there,
 * rather than after the click.
 *
 * Next already prefetches the route's JS on hover/viewport, so what remains on
 * a first navigation is the data: mount, fire the list request, show a
 * skeleton, wait a round trip. Starting that request on hover hides most of it
 * behind the time it takes to move the pointer and click.
 *
 * The keys below must match what each page's hook asks for exactly — a key that
 * differs by so much as a page size warms a cache row nobody reads. Prefetches
 * respect the client's `staleTime`, so repeatedly crossing a nav item does not
 * refire anything.
 */
type Prefetcher = (queryClient: QueryClient, accountId: string) => void

const ROUTE_PREFETCH: Record<string, Prefetcher> = {
  "/dashboard/contacts": (qc, accountId) => {
    // Mirrors the contacts page's initial `contactFilters`: no search, no
    // opt-in filter, first page.
    const filters = { limit: CONTACTS_PAGE_SIZE, offset: 0 }
    void qc.prefetchQuery({
      queryKey: queryKeys.contacts(accountId, filters),
      queryFn: () => listContacts(accountId, filters),
    })
  },
  "/dashboard/segments": (qc, accountId) => {
    void qc.prefetchQuery({
      queryKey: queryKeys.segments(accountId),
      queryFn: () => listSegments(accountId),
    })
  },
  "/dashboard/campaigns": (qc, accountId) => {
    void qc.prefetchQuery({
      queryKey: queryKeys.campaigns(accountId),
      queryFn: () => listCampaigns(accountId),
    })
  },
  "/dashboard/drips": (qc, accountId) => {
    void qc.prefetchQuery({
      queryKey: queryKeys.drips(accountId),
      queryFn: () => listDrips(accountId),
    })
  },
  "/dashboard/automation": (qc, accountId) => {
    void qc.prefetchQuery({
      queryKey: queryKeys.automationRules(accountId),
      queryFn: () => listAutomationRules(accountId),
    })
  },
  "/dashboard/flows": (qc, accountId) => {
    void qc.prefetchQuery({
      queryKey: queryKeys.flows(accountId),
      queryFn: () => listFlows(accountId),
    })
  },
  "/dashboard/whatsapp-flows": (qc, accountId) => {
    void qc.prefetchQuery({
      queryKey: queryKeys.whatsappFlows(accountId),
      queryFn: () => listWhatsappFlows(accountId),
    })
  },
}

/**
 * Returns a callback to fire on nav-item hover/focus. A route with no entry, or
 * an account that hasn't resolved yet, is a no-op — never a reason to block.
 */
export function useNavPrefetch(accountId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useCallback(
    (href: string) => {
      if (!accountId) return
      ROUTE_PREFETCH[href]?.(queryClient, accountId)
    },
    [queryClient, accountId],
  )
}
