"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ACTIVE_PHONE_NUMBER_KEY,
  getActiveWhatsappContext,
  getAvailableWhatsappContexts,
  getUserDataFromCookie,
  invalidateAccountCaches,
  NUMBERS_CHANGED_EVENT,
  setActiveWhatsappPhoneNumberId,
  type WhatsappContext,
} from "@/services/api"

/**
 * The number the whole dashboard works on — chat, campaigns, templates,
 * analytics — and the one place that changes it.
 *
 * Most pages read the active number once, on mount, through
 * `getActiveWhatsappContext()`. Rather than teach every one of them to listen,
 * a switch bumps `numberEpoch`, and the dashboard layout keys its page on that
 * epoch: the page re-mounts and reads the new number like a fresh visit. The
 * epoch only moves on a switch, never on first load, so a normal navigation
 * mounts the page once.
 */
let numberEpoch = 0
const listeners = new Set<() => void>()

function bumpNumberEpoch() {
  numberEpoch += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Changes whenever the active number does. Key the page on it. */
export function useNumberEpoch(): number {
  return useSyncExternalStore(
    subscribe,
    () => numberEpoch,
    () => 0,
  )
}

export const activeNumberKey = (userId: string | null) => ["active-number", userId] as const

/**
 * `followOtherTabs`: listen for switches made in another tab. Set it in one
 * always-mounted place (the dashboard layout) — every listener re-mounts the
 * page, so two would do it twice.
 */
export function useActiveNumber({ followOtherTabs = false }: { followOtherTabs?: boolean } = {}) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setUserId(getUserDataFromCookie()?.id ?? null)
    setMounted(true)
  }, [])

  const query = useQuery({
    queryKey: activeNumberKey(userId),
    queryFn: async () => {
      const [active, numbers] = await Promise.all([getActiveWhatsappContext(), getAvailableWhatsappContexts()])
      return { active, numbers }
    },
    enabled: mounted && Boolean(userId),
    // A number, once found, rarely changes outside a switch (which updates
    // this cache itself). "No number" is different: it ends the moment
    // onboarding finishes, and nothing in onboarding invalidates this key, so
    // a cached null would tell a freshly-connected user to go connect one.
    // Re-check it on every mount instead.
    staleTime: (q) => (q.state.data?.active ? 5 * 60 * 1000 : 0),
  })

  /** Everything number-scoped refetches; the account may differ too. */
  const afterSwitch = useCallback(
    (next: WhatsappContext) => {
      queryClient.setQueryData(activeNumberKey(userId), (prev: typeof query.data) =>
        prev ? { ...prev, active: next } : prev,
      )
      // The re-mounted page reads `useAccountId` from cache before the refetch
      // below lands; give it the new number's account now, not the old one.
      queryClient.setQueryData(["account-id", userId], next.accountId)
      bumpNumberEpoch()
      // Not awaited: the re-mounted page starts its own requests, and every
      // cached query (account id included) is marked stale underneath it.
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "active-number",
      })
    },
    [queryClient, userId],
  )

  const numbers = query.data?.numbers ?? []
  const active = query.data?.active ?? null

  const switchNumber = useCallback(
    (phoneNumberId: string) => {
      const next = numbers.find((n) => n.phoneNumberId === phoneNumberId)
      if (!next || next.phoneNumberId === active?.phoneNumberId) return
      setActiveWhatsappPhoneNumberId(next.phoneNumberId)
      afterSwitch(next)
    },
    [numbers, active?.phoneNumberId, afterSwitch],
  )

  /**
   * Re-reads the accounts this user can open — one may be new, e.g. a team
   * just joined — and switches to a number on `accountId`. Resolves false when
   * that account has no connected number to switch to; the account list is
   * refreshed either way.
   */
  const switchToAccount = useCallback(
    async (accountId: string): Promise<boolean> => {
      invalidateAccountCaches()
      const fresh = await getAvailableWhatsappContexts()
      queryClient.setQueryData(activeNumberKey(userId), (prev: typeof query.data) =>
        prev ? { ...prev, numbers: fresh } : prev,
      )
      const next = fresh.find((n) => n.accountId === accountId)
      if (!next) {
        void queryClient.invalidateQueries()
        return false
      }
      if (next.phoneNumberId !== active?.phoneNumberId) {
        setActiveWhatsappPhoneNumberId(next.phoneNumberId)
        afterSwitch(next)
      }
      return true
    },
    [queryClient, userId, active?.phoneNumberId, afterSwitch],
  )

  // Another tab switched: follow it, so two tabs never send from different
  // numbers while showing the same one.
  useEffect(() => {
    if (!followOtherTabs) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVE_PHONE_NUMBER_KEY || !e.newValue) return
      if (e.newValue === active?.phoneNumberId) return
      const next = numbers.find((n) => n.phoneNumberId === e.newValue)
      if (next) afterSwitch(next)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [followOtherTabs, numbers, active?.phoneNumberId, afterSwitch])

  // A number was added, registered, linked, recovered or disconnected (see
  // `numbersChanged` in services/api). Re-read: the cached active number may be
  // the one just removed, and every page reads it from here. Registered once,
  // on the always-mounted instance, like the cross-tab listener above.
  const activeIdRef = useRef(active?.phoneNumberId)
  activeIdRef.current = active?.phoneNumberId
  useEffect(() => {
    if (!followOtherTabs) return
    const onNumbersChanged = async () => {
      const before = activeIdRef.current
      const res = await query.refetch()
      const next = res.data?.active ?? null
      // The active number itself changed (it was disconnected and the lookup
      // fell back to another): treat it as a switch, so pages re-mount on the
      // new number instead of keeping state built for the old one. Only when
      // there WAS one: a first number arriving mid-onboarding must not
      // re-mount the onboarding page under the person finishing it.
      if (before && next && next.phoneNumberId !== before) afterSwitch(next)
    }
    window.addEventListener(NUMBERS_CHANGED_EVENT, onNumbersChanged)
    return () => window.removeEventListener(NUMBERS_CHANGED_EVENT, onNumbersChanged)
    // `query.refetch` is stable for the life of the observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followOtherTabs, afterSwitch])

  const hasNoNumber = mounted && (!userId || (query.isSuccess && !query.isFetching && !query.data?.active))

  return {
    active,
    numbers,
    switchNumber,
    switchToAccount,
    isLoading: query.isLoading,
    /**
     * True once the lookup has settled, successfully or not. On its own it
     * does NOT make a null `active` mean "no number" — check `error` first, or
     * use `hasNoNumber`.
     */
    resolved: mounted && (!userId || query.isSuccess || query.isError),
    /**
     * The lookup failed. `active` is null then because we couldn't ask, not
     * because there's nothing connected — say so, don't send them to onboarding.
     */
    error: query.error,
    /**
     * Settled, succeeded, and still re-checking nothing: the only state in
     * which a null `active` is a claim worth showing. A cached null being
     * re-checked (see `staleTime`) is still a question, not an answer.
     */
    hasNoNumber,
    /**
     * No number yet, and no answer about it either: still looking. A query
     * keyed on `active?.accountId` sits disabled (not loading) in this state,
     * so pages fold this into their own loading flag rather than letting the
     * disabled query read as "loaded, nothing there".
     */
    pending: !active && !query.error && !hasNoNumber,
    retry: query.refetch,
  }
}
