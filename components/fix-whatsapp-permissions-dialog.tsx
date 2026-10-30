"use client"

import { useEffect, useRef, useState } from "react"
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
 *
 * Meta's 2026 account-model split (live now, Phase 1) breaks that grant into
 * two separate assets the customer must share independently — a "WhatsApp
 * account" (holds the number) and a "Messaging account" (holds templates;
 * this is what `wabaId` below actually identifies, since the old WABA ID now
 * means the Messaging account). Meta states messaging "does not work unless
 * the partner has access to both." Our check can only ever confirm the
 * Messaging-account half: Meta doesn't expose a WhatsApp-account ID through
 * the API yet (`primary_waac_ids` stays empty until Phase 2, H1 2027), so
 * there's no ID to poll `assigned_users` against for the other one. Hence
 * the second, unverifiable instruction step below, and the caveat shown even
 * after `granted` is true.
 */
export function FixWhatsAppPermissionsDialog({
  open,
  onOpenChange,
  accountId,
  onGranted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId: string
  /** Fires once, the moment a check first finds access granted — lets a caller
   *  that opened this dialog after a failed action (template delete/edit) retry
   *  it automatically instead of leaving the customer to redo it by hand. */
  onGranted?: () => void
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
  const wasGrantedRef = useRef(false)

  const check = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getPartnerAccessStatus(accountId)
      setStatus(result)
      if (result.granted) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.partnerAccessStatus(accountId) })
        if (!wasGrantedRef.current) {
          wasGrantedRef.current = true
          onGranted?.()
        }
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
            <div className="space-y-4">
              <StatusNote tone="success">
                Messaging account access confirmed. If template delete/edit still doesn't work, the WhatsApp
                account below is almost always why — we can't check that part automatically yet.
              </StatusNote>

              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  From{" "}
                  <a
                    href="https://business.facebook.com/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline"
                  >
                    Business Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  go to Accounts → <span className="font-medium text-foreground">WhatsApp accounts</span> (a
                  separate list from Messaging accounts, which is already fixed) → the entry for this same
                  number → Partners tab.
                </li>
                <li>
                  Same as before: if it&apos;s already listed, click the row to edit it rather than searching to
                  add it again. Set <span className="font-medium text-foreground">Full access</span> using this ID:
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
            </div>
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
                <li>
                  Go to Accounts →{" "}
                  <span className="font-medium text-foreground">Messaging accounts</span> → your account → the
                  Partners tab. Already listed there? Click it instead of searching to add it again — a partner
                  that already has some access can only be upgraded from its own row.
                </li>
                <li>
                  Choose <span className="font-medium text-foreground">Assign Partner</span> (or, for an existing
                  row, open it) and set <span className="font-medium text-foreground">Full access</span> using this
                  ID:
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

              <ol start={4} className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Then, from{" "}
                  <a
                    href="https://business.facebook.com/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline"
                  >
                    Business Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  go to Accounts → <span className="font-medium text-foreground">WhatsApp accounts</span> (a
                  separate list from Messaging accounts — we can&apos;t link straight to the entry here, Meta
                  doesn&apos;t expose that specific ID yet) → the entry for this same number → Partners tab, and
                  repeat step 3 there with the same ID. Meta keeps these two separate, and messaging stays broken
                  until both are done.
                </li>
              </ol>

              <p className="text-sm text-muted-foreground">
                Come back here and check again once both are set. It usually updates within a minute.
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
