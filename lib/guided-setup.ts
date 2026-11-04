import { env } from "@/lib/env"

/**
 * The step-by-step WhatsApp setup (redirect Facebook login at
 * /dashboard/whatsapp/new, then the business pick at step-1) is waiting on a
 * Meta permission review, and fails for customers until it clears. Off unless
 * NEXT_PUBLIC_GUIDED_SETUP_ENABLED is "true"; flip it and redeploy once Meta
 * approves.
 *
 * Only the entry is gated. step-2 onwards stay open: the pop-up (Embedded
 * Signup) flow and the WhatsApp page's "Continue setup"/"Verify number"
 * actions use those pages too.
 */
export const GUIDED_SETUP_ENABLED = env.NEXT_PUBLIC_GUIDED_SETUP_ENABLED === "true"

export const GUIDED_SETUP_REVIEW_TAG = "Under review by Meta"
export const GUIDED_SETUP_REVIEW_MESSAGE =
  "Meta is reviewing this setup route. It will be available soon. Until then, connect with Facebook using one of the options above."
