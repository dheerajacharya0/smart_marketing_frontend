import type { WhatsappPhoneNumber } from "@/services/api"

/**
 * Whether onboarding step 2 can skip the register step for a number. Two
 * sources, either is enough:
 *
 * - our own row for the number says `registered` (we registered it before);
 * - Meta reports it on the Cloud API (`platform_type: "CLOUD_API"`), e.g. it
 *   was registered from another signup or straight in Meta.
 *
 * Without this the page asked for the PIN again on a live number, where a
 * different PIN only earns a "PIN mismatch" error on a number that works.
 */
export function isNumberRegistered(
  phoneNumberId: string | null | undefined,
  metaDetails: { platform_type?: unknown } | null | undefined,
  ourNumbers: Pick<WhatsappPhoneNumber, "phoneNumberId" | "status">[] | null | undefined
): boolean {
  if (!phoneNumberId) return false
  if (metaDetails?.platform_type === "CLOUD_API") return true
  return (ourNumbers ?? []).some((n) => n.phoneNumberId === phoneNumberId && n.status === "registered")
}
