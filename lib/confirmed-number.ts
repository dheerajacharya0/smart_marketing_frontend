import type { WhatsappPhoneNumber } from "@/services/api"

interface MetaPhoneDetails {
  id?: string
  display_phone_number?: string
  verified_name?: string
  code_verification_status?: string
  quality_rating?: string
  [key: string]: unknown
}

/**
 * What onboarding step 4 shows for the number just connected.
 *
 * Meta's details come from the WABA list, which holds only WABAs owned by the
 * business picked in step 1 and only each WABA's first number. They are used
 * when they are this number's; otherwise our own row for the number supplies
 * the digits and name. Before this, a number from another business (or a
 * second number in its WABA) showed "—" for both.
 */
export function confirmedNumber(
  phoneNumberId: string,
  metaDetails: MetaPhoneDetails | null | undefined,
  ourNumbers: Pick<WhatsappPhoneNumber, "phoneNumberId" | "displayPhoneNumber" | "verifiedName">[] | null | undefined
): { details: MetaPhoneDetails | null; phoneNumber: string; displayName: string } {
  const details =
    metaDetails && (!phoneNumberId || !metaDetails.id || metaDetails.id === phoneNumberId) ? metaDetails : null
  const row = phoneNumberId ? (ourNumbers ?? []).find((n) => n.phoneNumberId === phoneNumberId) : undefined
  return {
    details,
    phoneNumber: details?.display_phone_number || row?.displayPhoneNumber || "",
    displayName: details?.verified_name || row?.verifiedName || "",
  }
}
