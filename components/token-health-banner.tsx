"use client"

import { AlertTriangle, Clock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import type { FacebookAccount, EmbeddedSignupResult } from "@/services/api"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** True when a healthy token expires within 7 days (soft, no action required). */
function isExpiringSoon(account: Pick<FacebookAccount, "needsReauth" | "tokenExpiresAt">): boolean {
  if (account.needsReauth || !account.tokenExpiresAt) return false
  const ms = new Date(account.tokenExpiresAt).getTime() - Date.now()
  return ms > 0 && ms <= SEVEN_DAYS_MS
}

function accountLabel(account: Pick<FacebookAccount, "name" | "id">): string {
  return account.name || `Account ${account.id.slice(0, 8)}`
}

/**
 * Token-health prompts (Feature 2). Renders a persistent RED re-link banner for
 * every account whose FB token is dead (`needsReauth`), and a soft AMBER notice
 * for accounts expiring within 7 days. Reconnect reuses the shared Embedded
 * Signup flow; a fresh link clears the flag backend-side. Render at
 * account/settings level (not the wallet screen).
 */
export function TokenHealthBanners({
  accounts,
  onReconnected,
}: {
  accounts: Array<Pick<FacebookAccount, "id" | "name" | "needsReauth" | "tokenExpiresAt">>
  onReconnected?: (result: EmbeddedSignupResult) => void
}) {
  const dead = accounts.filter((a) => a.needsReauth)
  const expiring = accounts.filter(isExpiringSoon)

  if (dead.length === 0 && expiring.length === 0) return null

  return (
    <div className="space-y-3">
      {dead.map((account) => (
        <Alert key={account.id} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Reconnect Facebook to keep messaging</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong>{accountLabel(account)}</strong>&apos;s Facebook connection has expired. Messaging is
              paused for this account until you re-link it.
            </span>
            <ConnectWhatsAppButton
              label="Reconnect Facebook"
              variant="destructive"
              size="sm"
              onSuccess={onReconnected}
            />
          </AlertDescription>
        </Alert>
      ))}

      {expiring.map((account) => (
        <Alert key={account.id} className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <Clock className="h-4 w-4" />
          <AlertTitle>Your WhatsApp connection renews soon</AlertTitle>
          <AlertDescription>
            <strong>{accountLabel(account)}</strong> renews automatically — no action needed unless this turns
            red.
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
