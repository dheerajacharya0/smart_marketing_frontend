"use client"

import { useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAccountId } from "@/hooks/use-account-id"
import { useWhatsappPhoneNumbers, usePartnerAccessStatus } from "@/hooks/use-queries"
import { FixWhatsAppPermissionsDialog } from "@/components/fix-whatsapp-permissions-dialog"

/**
 * Persistent, app-wide nudge for an account with a recovered number that
 * still hasn't had the manual Meta Business Settings step done — see
 * fix-whatsapp-permissions-dialog.tsx for what's missing and why it can't be
 * done any other way. Mounted once, in the dashboard layout, same pattern as
 * PendingInvitesBanner.
 *
 * Trigger is two-stage on purpose:
 *  1. `usesSystemToken` on any of the account's numbers — free, already-
 *     fetched data, true for every normal account. Only recovered numbers
 *     ever reach stage 2.
 *  2. The live `granted` check — only fetched for that narrow subset, so a
 *     normal account never pays for (or risks a false positive from) a
 *     round trip to Meta. Disappears on its own once the customer finishes
 *     the manual step and this flips to true.
 */
export function WabaPermissionBanner() {
  const { accountId } = useAccountId()
  const { data: numbers } = useWhatsappPhoneNumbers(accountId)
  const hasRecoveredNumber = Boolean(numbers?.some((n) => n.usesSystemToken))
  const { data: status } = usePartnerAccessStatus(accountId, hasRecoveredNumber)
  const [open, setOpen] = useState(false)

  if (!hasRecoveredNumber || !status || status.granted) return null

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-warning/20 bg-warning-soft px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2 sm:items-center">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning sm:mt-0" />
          <span className="text-warning">
            Your WhatsApp number needs one more permission from you — template delete/edit and a few other actions
            won&apos;t work until it&apos;s granted.
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
          Fix now
        </Button>
      </div>
      {accountId ? (
        <FixWhatsAppPermissionsDialog open={open} onOpenChange={setOpen} accountId={accountId} />
      ) : null}
    </>
  )
}
