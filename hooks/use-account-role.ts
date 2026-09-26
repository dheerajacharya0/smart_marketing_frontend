"use client"

import { useAccountId } from "@/hooks/use-account-id"
import { useFacebookAccounts } from "@/hooks/use-queries"
import { roleAllows, type AccessLevel, type AccountRole } from "@/lib/access"

/**
 * The signed-in user's role on the current account, from the `role` the
 * backend puts on each entry of /auth/facebook-accounts.
 *
 * `null` while unknown. Callers deciding whether to *hide* something should
 * treat unknown as "don't hide yet" or "don't show yet" deliberately — see
 * `can`, which answers false until the role is known.
 *
 * An entry with no `role` is an older backend that only ever listed owned
 * accounts, so it reads as owner.
 */
export function useAccountRole() {
  const { accountId, resolved } = useAccountId()
  const { data: accounts, isSuccess } = useFacebookAccounts(Boolean(accountId))
  const entry = accounts?.find((a) => a.id === accountId)

  const role: AccountRole | null = !accountId
    ? // No account yet: whoever is here is setting one up, i.e. an owner-to-be.
      resolved
      ? "owner"
      : null
    : isSuccess
      ? (entry?.role ?? "owner")
      : null

  return {
    role,
    isOwner: role === "owner",
    /** Owner or admin. */
    isManager: role === "owner" || role === "admin",
    /** Whether the role is known and allows `level`. False while loading. */
    can: (level: AccessLevel) => (role ? roleAllows(role, level) : false),
  }
}
