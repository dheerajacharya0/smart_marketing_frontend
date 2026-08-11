"use client"

import { useState } from "react"
import { Wallet as WalletIcon, Plus, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/errors"
import { formatMoney } from "@/lib/money"
import { useWallet } from "@/hooks/use-queries"
import { TopUpDialog } from "@/components/billing/top-up-dialog"

/** Below this (but above 0) the balance shows amber. At/below 0 it shows red. */
const LOW_BALANCE_THRESHOLD = 1

/** Wallet balance card (Feature 3A): balance + currency, low/empty coloring, top-up. */
export function WalletBalanceCard({ accountId }: { accountId: string | null | undefined }) {
  const { data: wallet, isLoading, error } = useWallet(accountId)
  const [topUpOpen, setTopUpOpen] = useState(false)

  const balance = wallet?.balance ?? 0
  const currency = wallet?.currency ?? "USD"
  const empty = balance <= 0
  const low = !empty && balance < LOW_BALANCE_THRESHOLD

  const tone = empty
    ? "text-destructive"
    : low
      ? "text-amber-600 dark:text-amber-400"
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
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                Running low — consider topping up.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Balance in {currency}.</p>
            )}
          </>
        )}
      </CardContent>

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} accountId={accountId} currency={currency} />
    </Card>
  )
}
