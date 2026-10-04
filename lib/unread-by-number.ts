import type { UnreadTotal } from "@/services/api"

/**
 * The inbox badge for the number being worked on.
 *
 * An older backend sends only the account-wide `total`; fall back to it rather
 * than showing nothing, so the badge never under-reports.
 */
export function unreadForNumber(unread: UnreadTotal | null | undefined, phoneNumberId: string | null | undefined): number {
  if (!unread) return 0
  if (!unread.byPhoneNumber || !phoneNumberId) return unread.total ?? 0
  return unread.byPhoneNumber[phoneNumberId] ?? 0
}

/** Unread waiting on the account's other numbers — flagged in the switcher. */
export function unreadOnOtherNumbers(
  unread: UnreadTotal | null | undefined,
  phoneNumberId: string | null | undefined,
): number {
  if (!unread?.byPhoneNumber || !phoneNumberId) return 0
  return Object.entries(unread.byPhoneNumber).reduce(
    (sum, [id, count]) => (id === phoneNumberId ? sum : sum + count),
    0,
  )
}
