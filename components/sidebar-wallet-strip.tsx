"use client"

import Link from "next/link"
import { useAccountId } from "@/hooks/use-account-id"
import { useWallet } from "@/hooks/use-queries"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, FALLBACK_CURRENCY, LOW_BALANCE_THRESHOLD } from "@/lib/money"

/**
 * Wallet balance in the sidebar header. Replaces the old hardcoded
 * "Current Plan: Premium / API Usage 65%" block — the product bills per
 * conversation from a prepaid wallet, not per plan tier, so this shows the one
 * number that actually stops a send when it hits zero.
 */
export function SidebarWalletStrip() {
  const { accountId, resolved } = useAccountId()
  const { data: wallet, isLoading, error } = useWallet(accountId)

  // No connected account (or the balance failed to load): show nothing rather
  // than a misleading zero.
  if ((resolved && !accountId) || error) return null

  const balance = wallet?.balance ?? 0
  const currency = wallet?.currency ?? FALLBACK_CURRENCY
  const empty = balance <= 0
  const low = !empty && balance < LOW_BALANCE_THRESHOLD

  const tone = empty
    ? "text-destructive"
    : low
      ? "text-amber-600 dark:text-amber-400"
      : "text-sidebar-foreground"

  return (
    <Link
      href="/dashboard/billing"
      className="block rounded-lg bg-sidebar-accent/30 p-3 mb-2 transition-colors hover:bg-sidebar-accent/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-sidebar-muted-foreground">Wallet balance</span>
        {isLoading || !wallet ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className={`font-mono text-sm font-semibold tabular-nums ${tone}`}>
            {formatMoney(balance, currency)}
          </span>
        )}
      </div>
      {wallet && (empty || low) && (
        <p className={`mt-1 text-xs ${tone}`}>
          {empty ? "Empty — top up to keep sending." : "Running low — top up soon."}
        </p>
      )}
    </Link>
  )
}
