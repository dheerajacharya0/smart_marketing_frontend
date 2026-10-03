"use client"

import { useState } from "react"
import { Wallet as WalletIcon, Plus, AlertTriangle } from "lucide-react"
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
            {empty ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Wallet empty — top up to keep sending messages.
              </p>
            ) : low ? (
              <p className="mt-1 text-sm text-warning">
                Running low — consider topping up.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Balance in {currency}.</p>
            )}
            {/* Shown in every balance state: an empty wallet is exactly when a
                customer needs to know Meta's charges are separate. */}
            {coverage.covers === "platform_fee" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Pays our platform fee per message. Meta bills the messages themselves to the card on
                your WhatsApp Business account — <BillingHubLink />.
              </p>
            ) : coverage.covers === "meta_cost_and_platform_fee" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Pays Meta&apos;s message charges and our platform fee.
              </p>
            ) : coverage.covers === "mixed" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                What this pays for depends on the sending number — see below.
              </p>
            ) : null}
            {coverage.numbers.length > 1 || coverage.covers === "mixed" ? (
              <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                {coverage.numbers.map((n) => (
                  <li key={n.phoneNumberId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-foreground">{numberLabel(n)}</span>
                    <span className="text-muted-foreground">
                      {n.walletCovers === "meta_cost_and_platform_fee"
                        ? "Wallet pays Meta + platform fee"
                        : "Wallet pays platform fee · Meta bills your card"}
                    </span>
                  </li>
                ))}
                {coverage.covers === "mixed" ? (
                  <li className="pt-1 text-muted-foreground">
                    Card-billed numbers: <BillingHubLink />.
                  </li>
                ) : null}
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
