"use client"

import { PageHeader } from "@/components/page-header"
import { useAccountId } from "@/hooks/use-account-id"
import { WalletBalanceCard } from "@/components/billing/wallet-balance-card"
import { StatementTable } from "@/components/billing/statement-table"

export default function BillingPage() {
  const { accountId, resolved } = useAccountId()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your prepaid wallet — top up, and see every credit and per-message debit."
      />

      {resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet — link a Facebook/WhatsApp account to use the wallet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:max-w-md">
            <WalletBalanceCard accountId={accountId} />
          </div>
          <StatementTable accountId={accountId} />
        </>
      )}
    </div>
  )
}
