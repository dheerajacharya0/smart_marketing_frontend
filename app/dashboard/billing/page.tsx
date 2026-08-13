"use client"

import { PageHeader } from "@/components/page-header"
import { useAccountId } from "@/hooks/use-account-id"
import { WalletBalanceCard } from "@/components/billing/wallet-balance-card"
import { StatementTable } from "@/components/billing/statement-table"
import { TopupOrdersTable } from "@/components/billing/topup-orders-table"

export default function BillingPage() {
  const { accountId, resolved, error } = useAccountId()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your prepaid wallet — top up, and see every credit and per-message debit."
      />

      {error ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Couldn&apos;t check your account just now — reload to try again.
        </div>
      ) : resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet — link a Facebook/WhatsApp account to use the wallet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:max-w-md">
            <WalletBalanceCard accountId={accountId} />
          </div>
          <TopupOrdersTable accountId={accountId} />
          <StatementTable accountId={accountId} />
        </>
      )}
    </div>
  )
}
