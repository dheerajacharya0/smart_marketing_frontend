/**
 * Narrow an account-wide list to the number being worked on.
 *
 * Campaigns, drips, chatbot flows, automation rules and calls each belong to
 * one number, but the backend lists them per account. With two numbers on one
 * account, switching to the second still showed the first's items — and acting
 * on one (resume, toggle, edit) acted on the other number's.
 *
 * Without a number yet (still resolving), the list passes through unchanged
 * rather than flashing empty.
 */
export function forActiveNumber<T extends { phoneNumberId?: string | null }>(
  items: readonly T[],
  phoneNumberId: string | null | undefined,
): T[] {
  if (!phoneNumberId) return [...items]
  return items.filter((item) => item.phoneNumberId === phoneNumberId)
}
