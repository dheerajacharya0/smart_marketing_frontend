"use client"

import { useState } from "react"
import { Wallet as WalletIcon, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney, FALLBACK_CURRENCY, LOW_BALANCE_THRESHOLD } from "@/lib/money"
import { useWallet } from "@/hooks/use-queries"
import { TopUpDialog } from "@/components/billing/top-up-dialog"
import { numberLabel, walletCoverage } from "@/lib/wallet-coverage"

/** Wallet balance card (Feature 3A): balance + currency, low/empty coloring, top-up. */
export function WalletBalanceCard({ accountId }: { accountId: string | null | undefined }) {
  const { data: wallet, isLoading, error } = useWallet(accountId)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const coverage = walletCoverage(wallet)

  const balance = wallet?.balance ?? 0
  // Always the wallet's own currency; FALLBACK_CURRENCY only covers the frame
  // before the wallet has loaded.
  const currency = wallet?.currency ?? FALLBACK_CURRENCY
  const empty = balance <= 0
  const low = !empty && balance < LOW_BALANCE_THRESHOLD

  const tone = empty
    ? "text-destructive"
    : low
      ? "text-warning"
      : "text-foreground"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <WalletIcon className="h-4 w-4" /> Wallet balance
        </CardTitle>
        <Button size="sm" onClick={() => setTopUpOpen(true)} disabled={!accountId}>
          <Plus className="mr-1 h-4 w-4" /> Add credit
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : error ? (
          <p className="text-sm text-destructive">{getErrorMessage(error, "Couldn't load balance")}</p>
        ) : (
          <>
            <div className={`font-mono text-3xl font-bold tabular-nums ${tone}`}>
              {formatMoney(balance, currency)}
            </div>
            {/* Wallet debiting is retired (decided 2026-09-30): nothing is ever
                charged per message any more, so a zero/low balance is never a
                reason sending would stop — don't say otherwise. */}
            <p className="mt-1 text-sm text-muted-foreground">Balance in {currency}.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No per-message fee any more — this plan no longer charges one. Meta still bills your
              own card directly for WhatsApp messages — <BillingHubLink />. This is leftover balance,
              kept visible as history.
            </p>
            {coverage.numbers.length > 1 ? (
              <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                {coverage.numbers.map((n) => (
                  <li key={n.phoneNumberId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-foreground">{numberLabel(n)}</span>
                    <span className="text-muted-foreground">Meta bills your card directly</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </CardContent>

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} accountId={accountId} currency={currency} />
    </Card>
  )
}

function BillingHubLink() {
  return (
    <a
      href="https://business.facebook.com/billing_hub/accounts"
      target="_blank"
      rel="noreferrer"
      className="underline"
    >
      check it in Meta&apos;s Billing hub
    </a>
  )
}
