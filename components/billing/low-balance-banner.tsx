"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAccountId } from "@/hooks/use-account-id"
import { useWallet } from "@/hooks/use-queries"

/**
 * Global low-balance banner (Feature 3D): shows across the dashboard when the
 * wallet is empty (balance <= 0). Mounted once in the dashboard layout.
 */
export function LowBalanceBanner() {
  const { accountId } = useAccountId()
  const { data: wallet } = useWallet(accountId)

  if (!wallet || wallet.balance > 0) return null

  return (
    <div className="flex flex-col gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Wallet empty — top up to keep sending messages.
      </span>
      <Button asChild size="sm" variant="destructive">
        <Link href="/dashboard/billing">Add credit</Link>
      </Button>
    </div>
  )
}
