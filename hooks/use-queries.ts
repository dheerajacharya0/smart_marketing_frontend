"use client"

/**
 * Typed TanStack Query hooks (Phase A.1) wrapping the typed API layer.
 *
 * These are the migration target for pages still hand-rolling `useState + fetch`.
 * Each hook keys on the resource + account so results dedup and cache across the
 * app. Add one per read as you migrate a page; mutations use `useMutation` with
 * `queryClient.invalidateQueries` to refresh affected lists.
 */
import { useQuery } from "@tanstack/react-query"
import {
  listSegments,
  listContacts,
  getContactAttributeKeys,
  getWallet,
  getBillingEntries,
  type ContactListFilters,
} from "@/services/api"

export const queryKeys = {
  segments: (accountId: string) => ["segments", accountId] as const,
  contacts: (accountId: string, filters?: ContactListFilters) =>
    ["contacts", accountId, filters ?? {}] as const,
  contactAttributeKeys: (accountId: string) => ["contact-attribute-keys", accountId] as const,
  wallet: (accountId: string) => ["wallet", accountId] as const,
  billingEntries: (accountId: string, limit: number, offset: number) =>
    ["billing-entries", accountId, limit, offset] as const,
}

/** Live segment list for an account. Disabled until an accountId is known. */
export function useSegments(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.segments(accountId ?? ""),
    queryFn: () => listSegments(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Paginated/filtered contacts for an account. */
export function useContacts(accountId: string | null | undefined, filters?: ContactListFilters) {
  return useQuery({
    queryKey: queryKeys.contacts(accountId ?? "", filters),
    queryFn: () => listContacts(accountId as string, filters),
    enabled: Boolean(accountId),
  })
}

/** Distinct custom-attribute keys (server-side DISTINCT). */
export function useContactAttributeKeys(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.contactAttributeKeys(accountId ?? ""),
    queryFn: () => getContactAttributeKeys(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Prepaid wallet balance. Debits lag a send by a few seconds (webhook delay). */
export function useWallet(accountId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet(accountId ?? ""),
    queryFn: () => getWallet(accountId as string),
    enabled: Boolean(accountId),
  })
}

/** Paginated statement, newest first. */
export function useBillingEntries(
  accountId: string | null | undefined,
  limit = 50,
  offset = 0
) {
  return useQuery({
    queryKey: queryKeys.billingEntries(accountId ?? "", limit, offset),
    queryFn: () => getBillingEntries(accountId as string, limit, offset),
    enabled: Boolean(accountId),
  })
}
