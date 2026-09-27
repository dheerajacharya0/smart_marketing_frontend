"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { listCalls } from "@/services/api"

/**
 * Missed incoming calls since this browser last opened the Calls page.
 *
 * "Seen" is a per-browser convenience kept in localStorage, not a server-side
 * read state: a missed call is shared by the whole team, and the badge only
 * answers "has something been missed since I last looked".
 */

/** With nothing stored, count the last day — enough to notice, not a backlog. */
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000

const seenKey = (accountId: string) => `calls:seen:${accountId}`

export const missedCallsKey = (accountId: string) => ["missed-calls", accountId] as const

export function readCallsSeen(accountId: string): string {
  try {
    const stored = window.localStorage.getItem(seenKey(accountId))
    if (stored && !Number.isNaN(Date.parse(stored))) return stored
  } catch {
    // Storage blocked (private mode): fall through to the default window.
  }
  return new Date(Date.now() - DEFAULT_WINDOW_MS).toISOString()
}

export function useMissedCallCount(accountId: string | null | undefined) {
  return useQuery({
    queryKey: missedCallsKey(accountId ?? ""),
    queryFn: async () => {
      const page = await listCalls(accountId as string, {
        direction: "inbound",
        status: "missed",
        since: readCallsSeen(accountId as string),
        limit: 1,
      })
      return page.total
    },
    enabled: Boolean(accountId),
    staleTime: 30 * 1000,
    // A teammate who can't take calls gets a 403: no badge, no retries.
    retry: false,
  })
}

/** Clear the badge — called when the Calls page opens. */
export function useMarkCallsSeen() {
  const queryClient = useQueryClient()
  return useCallback(
    (accountId: string) => {
      try {
        window.localStorage.setItem(seenKey(accountId), new Date().toISOString())
      } catch {
        // Nothing to remember it in; the badge just comes back next load.
      }
      queryClient.setQueryData(missedCallsKey(accountId), 0)
    },
    [queryClient],
  )
}
