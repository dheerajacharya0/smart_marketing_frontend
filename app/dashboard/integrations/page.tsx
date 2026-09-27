"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Store, Unplug } from "lucide-react"
import { toast } from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { getErrorMessage } from "@/lib/errors"
import { formatDateTime } from "@/lib/format-date"
import { describeShopifyError } from "@/lib/store-sync"
import { useAccountId } from "@/hooks/use-account-id"
import { queryKeys, useStores } from "@/hooks/use-queries"
import {
  disconnectStore,
  resyncStore,
  startShopifyInstall,
  type StoreConnection,
} from "@/services/api"

const STATUS_BADGE: Record<StoreConnection["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  syncing: { label: "Syncing", variant: "secondary" },
  connected: { label: "Connected", variant: "default" },
  error: { label: "Needs reconnecting", variant: "destructive" },
  disconnected: { label: "Disconnected", variant: "outline" },
}

/**
 * Reads the result Shopify's round trip leaves on the URL, says it once, and
 * clears it so a refresh doesn't repeat the toast. Its own component because
 * `useSearchParams()` needs a Suspense boundary or the production build fails.
 */
function ConnectResult() {
  const params = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accountId } = useAccountId()

  useEffect(() => {
    const result = params.get("shopify")
    if (!result) return
    if (result === "connected") {
      toast.success("Shopify connected. Pulling in the last 60 days of orders…")
      if (accountId) void queryClient.invalidateQueries({ queryKey: queryKeys.stores(accountId) })
    } else {
      toast.error(
        describeShopifyError(params.get("error"), {
          storeCurrency: params.get("storeCurrency"),
          accountCurrency: params.get("accountCurrency"),
        }),
        { duration: 8000 }
      )
    }
    router.replace("/dashboard/integrations")
  }, [params, router, queryClient, accountId])

  return null
}

function StoreRow({ store, accountId }: { store: StoreConnection; accountId: string }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<"resync" | "disconnect" | null>(null)
  const badge = STATUS_BADGE[store.status]
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.stores(accountId) })

  const run = async (kind: "resync" | "disconnect") => {
    setBusy(kind)
    try {
      if (kind === "resync") {
        await resyncStore(store.id, accountId)
        toast.success("Re-reading the last 60 days of orders")
      } else {
        await disconnectStore(store.id, accountId)
        toast.success("Store disconnected. Its past sales stay in your ledger.")
      }
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err) || "That didn't work")
    } finally {
      setBusy(null)
    }
  }

  const backfilling = store.backfillStatus === "pending" || store.backfillStatus === "running"
  const live = store.status !== "disconnected"

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{store.storeName || store.storeDomain}</span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {store.storeDomain} · {store.currency}
          </p>
        </div>
        {live && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => run("resync")}
              disabled={busy !== null || backfilling}
            >
              {busy === "resync" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Resync
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy !== null}>
                  <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect {store.storeName || store.storeDomain}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    New orders stop arriving and the app is removed from your Shopify store. Sales
                    already synced stay in your ledger — they happened, and your past reports
                    shouldn&apos;t change.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep syncing</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run("disconnect")}>Disconnect</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Orders synced</dt>
          <dd className="font-mono tabular-nums">
            {store.ordersSynced.toLocaleString()}
            {backfilling && <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-muted-foreground" />}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Without a phone number</dt>
          <dd className="font-mono tabular-nums">{store.ordersWithoutPhone.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Latest order</dt>
          <dd>{store.lastOrderAt ? formatDateTime(store.lastOrderAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Last synced</dt>
          <dd>{store.lastSyncedAt ? formatDateTime(store.lastSyncedAt) : "—"}</dd>
        </div>
      </dl>

      {store.ordersWithoutPhone > 0 && (
        <p className="text-xs text-muted-foreground">
          Orders without a phone number can&apos;t be matched to a WhatsApp contact, so they
          aren&apos;t in your revenue. Making phone required at checkout closes this gap.
        </p>
      )}
      {store.lastError && live && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {store.lastError}
        </p>
      )}
    </div>
  )
}

function ConnectShopify({ accountId, hasStore }: { accountId: string; hasStore: boolean }) {
  const [shop, setShop] = useState("")
  const [pending, setPending] = useState(false)

  const connect = async () => {
    if (!shop.trim()) return
    setPending(true)
    try {
      const { authorizeUrl } = await startShopifyInstall(accountId, shop.trim())
      // Full-page navigation: Shopify's approval screen can't be framed, and
      // the owner comes back through the backend's callback anyway.
      window.location.assign(authorizeUrl)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't start the Shopify connection")
      setPending(false)
    }
  }

  return (
    <form
      className="grid gap-2 sm:max-w-md"
      onSubmit={(e) => {
        e.preventDefault()
        void connect()
      }}
    >
      <Label htmlFor="shopify-domain">{hasStore ? "Connect another store" : "Your Shopify store"}</Label>
      <div className="flex gap-2">
        <Input
          id="shopify-domain"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="my-store.myshopify.com"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={pending || !shop.trim()}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Connect
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Use the myshopify.com address from your Shopify admin, not your custom domain. You&apos;ll
        approve read-only access to orders on Shopify, then come straight back here.
      </p>
    </form>
  )
}

/**
 * Store sync: connect an online store so every order arrives as a sale in the
 * revenue ledger, without the owner writing code or posting to our API.
 */
export default function IntegrationsPage() {
  const { accountId, resolved } = useAccountId()
  const { data, isLoading } = useStores(accountId)
  const shopifyStores = (data?.stores ?? []).filter((s) => s.platform === "shopify")
  const activeShopify = shopifyStores.filter((s) => s.status !== "disconnected")

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <ConnectResult />
      </Suspense>
      <PageHeader
        title="Store sync"
        description="Connect your online store so every order shows up in Revenue, credited to the message that led to it."
      />

      {resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet — link a Facebook/WhatsApp account first.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" /> Shopify
            </CardTitle>
            <CardDescription>
              New, edited, refunded and cancelled orders sync within seconds. Cash-on-delivery
              orders count when placed and are voided if cancelled or returned.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : data && !data.platforms.shopify.available ? (
              <p className="text-sm text-muted-foreground">
                Shopify isn&apos;t set up on this server yet. Contact support to enable it.
              </p>
            ) : (
              accountId && (
                <>
                  {shopifyStores.map((s) => (
                    <StoreRow key={s.id} store={s} accountId={accountId} />
                  ))}
                  <ConnectShopify accountId={accountId} hasStore={activeShopify.length > 0} />
                </>
              )
            )}
            {activeShopify.some((s) => s.status === "connected") && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Orders are flowing into{" "}
                <Link href="/dashboard/revenue" className="underline underline-offset-4">
                  Revenue
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
