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
/**
 * Whether the number is actually connected to this app: our own row for it
 * says `registered`. Not the same as `isNumberRegistered` — a number Meta has
 * on the Cloud API (its test number, one registered elsewhere) needs no PIN,
 * but isn't here until it is linked.
 */
export function isNumberConnectedHere(
  phoneNumberId: string | null | undefined,
  ourNumbers: Pick<WhatsappPhoneNumber, "phoneNumberId" | "status">[] | null | undefined
): boolean {
  if (!phoneNumberId) return false
  return (ourNumbers ?? []).some((n) => n.phoneNumberId === phoneNumberId && n.status === "registered")
}

export function isNumberRegistered(
  phoneNumberId: string | null | undefined,
  metaDetails: { platform_type?: unknown } | null | undefined,
  ourNumbers: Pick<WhatsappPhoneNumber, "phoneNumberId" | "status">[] | null | undefined
): boolean {
  if (!phoneNumberId) return false
  // Meta is the authority when it says. Our row can be stale — a number
  // deregistered at Meta still reads `registered` here, and skipping the PIN
  // for it would "finish" a number that cannot send.
  if (typeof metaDetails?.platform_type === "string") return metaDetails.platform_type === "CLOUD_API"
  return isNumberConnectedHere(phoneNumberId, ourNumbers)
}
