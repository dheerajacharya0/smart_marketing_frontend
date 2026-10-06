import {
  getAvailableWhatsappContexts,
  invalidateAccountCaches,
  setActiveWhatsappPhoneNumberId,
} from "@/services/api"

/**
 * After joining a team from outside the dashboard (the /invite page), make one
 * of its numbers the active one, so the full page load that follows opens in
 * the joined team rather than wherever the user last was. Resolves false when
 * the team has no connected number yet. Inside the dashboard, use
 * `useActiveNumber().switchToAccount`, which also re-mounts the page.
 */
export async function makeJoinedTeamActive(accountId: string): Promise<boolean> {
  invalidateAccountCaches()
  const contexts = await getAvailableWhatsappContexts()
  const next = contexts.find((c) => c.accountId === accountId)
  if (!next) return false
  setActiveWhatsappPhoneNumberId(next.phoneNumberId)
  return true
}
