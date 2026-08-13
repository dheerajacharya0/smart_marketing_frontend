"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  getFacebookAccounts,
} from "@/services/api"

/**
 * Resolves the current accountId: active WhatsApp context first, falling back to
 * the first linked Facebook account (features like contacts/segments don't
 * require a registered phone number).
 *
 * Runs through TanStack Query on a shared key so every consumer â€” sidebar,
 * banners, and the page itself â€” hits **one** in-flight request instead of each
 * refiring `/auth/facebook-accounts` on mount. It also retries: a single
 * transient network failure used to leave `accountId` null, which pages render
 * as "no account connected" â€” indistinguishable from genuinely having none.
 */
async function resolveAccountId(): Promise<string | null> {
  const ctx = await getActiveWhatsappContext()
  if (ctx) return ctx.accountId

  // No registered number yet â€” fall back to the first linked Facebook account.
  const accountsRes: unknown = await getFacebookAccounts()
  const accounts = Array.isArray(accountsRes)
    ? accountsRes
    : (accountsRes as { data?: unknown[] } | null)?.data
  const fbAccount = (accounts as { id: string; type: string }[] | undefined)?.find(
    (a) => a.type === "facebook"
  )
  return fbAccount?.id ?? null
}

export function useAccountId() {
  // The cookie is only readable client-side; read it after mount so the first
  // render matches the server's.
  const [userId, setUserId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setUserId(getUserDataFromCookie()?.id ?? null)
    setMounted(true)
  }, [])

  const query = useQuery({
    // userId scopes the cache to the signed-in user (so a re-login doesn't reuse
    // the previous account) — it is a cache key only, never sent to the backend.
    queryKey: ["account-id", userId] as const,
    queryFn: () => resolveAccountId(),
    enabled: mounted && Boolean(userId),
    // The linked account rarely changes mid-session; don't refetch per mount.
    staleTime: 5 * 60 * 1000,
  })

  const signedOut = mounted && !userId
  const settled = query.isSuccess || query.isError

  return {
    accountId: query.data ?? null,
    /** True once we know the answer â€” don't render "no account" before this. */
    resolved: signedOut || (mounted && settled),
    /**
     * Set when the lookup itself failed (after retries). `accountId` is null
     * here too, so check this before telling the user they have no account.
     */
    error: query.error ?? null,
  }
}
