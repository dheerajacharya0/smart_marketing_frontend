"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CreditCard, Lock, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { useAccountId } from "@/hooks/use-account-id"
import { useWallet } from "@/hooks/use-queries"
import { formatMoney } from "@/lib/money"
import { getUserDataFromCookie, type AuthUser } from "@/services/api"

/**
 * Profile.
 *
 * This page previously rendered a hardcoded "John Doe / john@example.com /
 * Super Admin" to every signed-in user, a "Company: Acme Inc" field, and a
 * **Subscription Details card with a fake saved card ("Visa ending in 4242"),
 * a Premium plan, a billing address and a next-billing date** — the same
 * fabricated billing content that was already deleted once with the mock
 * `/dashboard/subscription` page. The product bills per conversation from a
 * prepaid wallet; there are no plans and no stored cards.
 *
 * `AuthUser` also has no `role` field (see its docstring in services/api.ts), so
 * the "Super Admin" badge was reading `undefined` and rendering a constant.
 *
 * Everything shown now comes from the real session, and the wallet card is the
 * live balance. The edit/password/notification forms were removed rather than
 * left inert: there is no profile-update or change-password endpoint in
 * `services/api.ts`, so their Save buttons never did anything.
 */
export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const { accountId } = useAccountId()
  const wallet = useWallet(accountId)

  // The cookie is client-only; read after mount so the first render matches SSR.
  useEffect(() => {
    setUser(getUserDataFromCookie())
    setMounted(true)
  }, [])

  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details." />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Signed in as</CardTitle>
            <CardDescription>From your current session</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {!mounted ? (
              <>
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : (
              <>
                <Avatar className="h-24 w-24 border-4 border-primary/10">
                  <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  {user?.name && <h3 className="text-xl font-semibold">{user.name}</h3>}
                  <p className="break-all text-sm text-muted-foreground">
                    {user?.email ?? "Not signed in"}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account security</CardTitle>
            <CardDescription>Changing your password</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <EmptyState
              icon={Lock}
              title="Change your password by email"
              description="Editing your profile in-app isn't wired up yet. To change your password, use the reset link — it emails you a secure one-time link."
              action={
                <Button asChild variant="outline">
                  <Link href="/forgot-password">Send a reset link</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="flex-1">
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              You pay per conversation from a prepaid wallet — there are no plans or subscriptions.
            </CardDescription>
          </div>
          <CreditCard className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          {!accountId ? (
            <p className="text-sm text-muted-foreground">
              Connect a WhatsApp account to see your balance.
            </p>
          ) : wallet.isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : wallet.data ? (
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent p-2">
                <Wallet className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current balance</p>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {formatMoney(wallet.data.balance, wallet.data.currency)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Couldn&apos;t load your balance.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/dashboard/billing">Go to billing</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
