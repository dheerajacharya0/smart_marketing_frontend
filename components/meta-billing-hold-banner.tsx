"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { confirmMetaPayment } from "@/services/api"
import { queryKeys } from "@/hooks/use-queries"
import { getErrorMessage } from "@/lib/errors"

/** Where the WhatsApp Business account's card and tax details are managed. */
export const META_BILLING_URL = "https://business.facebook.com/billing_hub/accounts"

const COPY = {
  campaign: {
    what: "this campaign",
    rest: "The rest of the campaign is on hold, and everyone Meta rejected is back in the queue.",
    resumed: "Thanks. The campaign resumes within a few seconds.",
  },
  drip: {
    what: "this sequence",
    rest: "Every step is on hold, and anyone whose step Meta rejected is back on that step.",
    resumed: "Thanks. The sequence resumes on its next run.",
  },
} as const

/**
 * Meta refused sends with 131042: the WhatsApp Business account's payment
 * method or tax details are incomplete. The backend holds the campaign or drip
 * sequence (one probe message every 30 minutes) and puts back whoever Meta
 * refused, so nobody is lost while the customer fixes it.
 *
 * "I've fixed it" records the customer's word, which lifts the hold on the
 * next dispatcher run. If Meta refuses again, the hold comes back and the
 * refused people are put back again, so a mistaken click costs nothing.
 */
export function MetaBillingHoldBanner({
  subject,
  accountId,
  onResolved,
}: {
  subject: keyof typeof COPY
  accountId?: string | null
  onResolved?: () => void
}) {
  const copy = COPY[subject]
  const queryClient = useQueryClient()
  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () => confirmMetaPayment(accountId as string),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.metaPaymentStatus(accountId ?? ""), status)
      toast.success(copy.resumed)
      onResolved?.()
    },
    onError: (error) => {
      toast.error(`Couldn't save that: ${getErrorMessage(error)}. Try again in a moment.`)
    },
  })

  return (
    <Alert className="border-destructive/40 bg-destructive-soft">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <AlertTitle className="text-destructive">Held: Meta refused to bill your messages</AlertTitle>
      <AlertDescription className="text-destructive/80">
        <p>
          Meta rejected messages from {copy.what} (error 131042) because the payment method or tax
          details on your WhatsApp Business account are incomplete. {copy.rest} Nobody has been
          dropped.
        </p>
        <p className="mt-2">
          Complete them in Meta&apos;s billing settings. We try one message every 30 minutes and
          resume by ourselves as soon as one is delivered.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={META_BILLING_URL} target="_blank" rel="noopener noreferrer">
              Open Meta billing
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
          {accountId && (
            <Button size="sm" onClick={() => mutate()} disabled={isPending || isSuccess}>
              {isPending ? "Saving…" : "I've fixed it, resume now"}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
