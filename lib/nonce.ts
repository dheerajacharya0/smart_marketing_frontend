import { headers } from "next/headers"
import { NONCE_HEADER } from "@/lib/csp"

/**
 * This request's CSP nonce, set by middleware.ts. Pass it to every inline
 * <script> we render; without it the script is blocked once the nonce policy
 * is enforced.
 *
 * Reading headers() opts the calling route into dynamic rendering — a nonce is
 * per request, so a prerendered page could never carry a valid one.
 */
export async function getNonce(): Promise<string | undefined> {
  return (await headers()).get(NONCE_HEADER) ?? undefined
}
