"use client"

import { PageHeader } from "@/components/page-header"
import { useAccountId } from "@/hooks/use-account-id"
import { UsageByFeatureCard } from "@/components/billing/usage-by-feature-card"
import { InvoicesTable } from "@/components/billing/invoices-table"

export default function BillingPage() {
  const { accountId, resolved, error } = useAccountId()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="No per-message fee any more: this plan no longer charges one. Below is past
          invoices and feature usage. Meta still bills your own card directly for WhatsApp
          messages."
      />

      {error ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Couldn&apos;t check your account just now. Reload to try again.
        </div>
      ) : resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet. Link a Facebook/WhatsApp account first.
        </div>
      ) : (
        <>
          <UsageByFeatureCard accountId={accountId} />
          <InvoicesTable accountId={accountId} />
        </>
      )}
    </div>
  )
}
