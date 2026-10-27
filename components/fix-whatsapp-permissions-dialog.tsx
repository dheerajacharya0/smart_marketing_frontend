"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Copy, ExternalLink, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { StatusNote, Busy } from "@/components/onboarding/onboarding-ui"
import { getErrorMessage } from "@/lib/errors"
import { getPartnerAccessStatus } from "@/services/api"
import { queryKeys } from "@/hooks/use-queries"

/**
 * Some actions on a WhatsApp Business Account — deleting/editing a
 * template, changing WABA settings, deleting a number — are reserved for
 * the account's *owner*, not a partner with messaging/template access.
 * Numbers recovered through RecoverWhatsAppNumberDialog, and some from an
 * interrupted Embedded Signup, land in a Meta Business that only Converszio
 * has partner-level (not owner-level) access to; Meta error "(#100) Need
 * permission on either WhatsApp Business Account or owner/shared business"
 * is that gap surfacing. See reports/Orphaned WABA template permission
 * limits.md and reports/Customer self upgrade partner access.md.
 *
 * There is no API fix: reports/In app partner access feasibility.md
 * confirmed Meta requires the business's own admin to grant this by hand in
 * Business Settings — no token Converszio holds, including a fresh customer
 * OAuth token, can call the grant endpoint for a business it doesn't own.
 * This dialog is purely a guide-and-verify wrapper around that manual step:
 * it shows the customer where to click and polls our read-only status
 * check afterward to confirm the grant actually landed.
 */
export function FixWhatsAppPermissionsDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
}) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<{
    portfolioId: string | null
    wabaId: string
    granted: boolean
  } | null>(null)

  const check = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getPartnerAccessStatus(accountId)
      setStatus(result)
      if (result.granted) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.partnerAccessStatus(accountId) })
      }
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't check this right now. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId])

  const copyPortfolioId = async () => {
    if (!status?.portfolioId) return
    try {
      await navigator.clipboard.writeText(status.portfolioId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be unavailable (permissions, insecure context) — the ID
      // is still shown on screen to copy by hand.
    }
  }

  const metaSettingsHref = status?.wabaId
    ? `https://business.facebook.com/latest/settings/whatsapp_account/?selected_asset_id=${status.wabaId}&selected_asset_type=whatsapp-business-account`
    : "https://business.facebook.com/settings"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-4 pr-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Fix WhatsApp permissions</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                A few actions (deleting or editing a template, changing number settings) need an extra permission
                only you can grant, since Meta ties your WhatsApp number to a Business you own.
              </DialogDescription>
            </div>
          </div>

          {loading && !status ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Busy>Checking current access…</Busy>
            </div>
          ) : status?.granted ? (
            <StatusNote tone="success">
              Full access granted. Template delete, edit, and other owner actions should work now.
            </StatusNote>
          ) : (
            <div className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    href={metaSettingsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline"
                  >
                    Meta Business Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  and sign in with the Facebook account you used to set up WhatsApp.
                </li>
                <li>Go to Accounts → WhatsApp Accounts → your number → the Partners tab.</li>
                <li>
                  Choose <span className="font-medium text-foreground">Assign Partner</span> and paste this ID:
                </li>
              </ol>

              {status?.portfolioId ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm">{status.portfolioId}</code>
                  <Button type="button" variant="ghost" size="sm" onClick={copyPortfolioId} className="shrink-0">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground">
                Select <span className="font-medium text-foreground">Full control</span>, then assign. Come back here
                and check again. It usually updates within a minute.
              </p>
            </div>
          )}

          {error ? <StatusNote tone="error">{error}</StatusNote> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {status?.granted ? "Done" : "Close"}
          </Button>
          {!status?.granted ? (
            <Button disabled={loading} onClick={check}>
              {loading ? <Busy>Checking…</Busy> : "Check again"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
