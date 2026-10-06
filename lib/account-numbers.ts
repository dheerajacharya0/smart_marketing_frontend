import type { WhatsappPhoneNumber } from "@/services/api"

/**
 * Which of an account's numbers the WhatsApp table shows. An account can hold
 * several (one per signup), and the table has one row per account.
 *
 * The account's main number wins when it is registered; otherwise the oldest
 * registered one. Taking the first registered number unconditionally showed
 * an old number from a WABA the business sync can't see, so the page had no
 * way to look up its digits and rendered N/A.
 */
export function pickAccountNumbers(
  mainPhoneNumberId: string | null | undefined,
  numbers: WhatsappPhoneNumber[] | null | undefined
): { primary: WhatsappPhoneNumber | null; others: WhatsappPhoneNumber[] } {
  const registered = (numbers ?? []).filter((n) => n.status === "registered")
  const primary =
    registered.find((n) => mainPhoneNumberId && n.phoneNumberId === mainPhoneNumberId) ??
    registered[0] ??
    null
  return { primary, others: registered.filter((n) => n !== primary) }
}

/**
 * An account's numbers that were disconnected from it. Listed separately —
 * not as `others` — so the table can show them as disconnected with a way
 * back, while every sender picker keeps using registered numbers only.
 */
export function disconnectedNumbers(numbers: WhatsappPhoneNumber[] | null | undefined): WhatsappPhoneNumber[] {
  return (numbers ?? []).filter((n) => n.status === "disconnected")
}

/** How a number reads in a list: its digits, else its verified name, else its id. */
export function numberLabel(n: Pick<WhatsappPhoneNumber, "displayPhoneNumber" | "verifiedName" | "phoneNumberId">): string {
  return n.displayPhoneNumber || n.verifiedName || n.phoneNumberId
}
