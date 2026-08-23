"use client"

import { Fragment, useState } from "react"
import { Loader2, Plus, Radio, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/errors"
import { useWebhookDeliveries, useWebhookEndpoints } from "@/hooks/use-queries"
import { toast } from "react-hot-toast"
import {
  WEBHOOK_EVENT_NAMES,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  updateWebhookEndpoint,
  type CreatedWebhookEndpoint,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
  type WebhookEventName,
} from "@/services/api"

/** Plain-English reading of the four events the backend publishes. */
const EVENT_LABELS: Record<WebhookEventName, string> = {
  "message.sent": "Sent — we handed it to Meta",
  "message.delivered": "Delivered — it reached the handset",
  "message.read": "Read — the recipient opened it",
  "message.failed": "Failed — Meta rejected it or gave up",
}

const DELIVERY_TONE: Record<WebhookDeliveryStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  sending: "secondary",
  sent: "default",
  failed: "destructive",
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Health from the two timestamps the endpoint carries, rather than a stored
 * status column: "failing" here means the most recent thing that happened was a
 * failure, which is the question someone scanning this table is actually asking.
 */
function health(
  endpoint: WebhookEndpoint,
): { label: string; tone: "default" | "secondary" | "destructive" } {
  if (!endpoint.active) return { label: "Paused", tone: "secondary" }
  if (!endpoint.lastSuccessAt && !endpoint.lastFailureAt) {
    return { label: "No events yet", tone: "secondary" }
  }
  const success = endpoint.lastSuccessAt ? Date.parse(endpoint.lastSuccessAt) : -1
  const failure = endpoint.lastFailureAt ? Date.parse(endpoint.lastFailureAt) : -1
  return failure > success
    ? { label: "Failing", tone: "destructive" }
    : { label: "Healthy", tone: "default" }
}

/**
 * Attempt history for one endpoint, shown under the row it belongs to.
 *
 * Its own component so the query runs only while the history is expanded — one
 * panel per row mounted eagerly would be a request per endpoint on page load.
 */
function DeliveriesPanel({ accountId, endpointId }: { accountId: string; endpointId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useWebhookDeliveries(accountId, endpointId)
  const items = data?.items ?? []
  const total = data?.total ?? items.length

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {getErrorMessage(error, "Couldn't load delivery history")}.{" "}
        <button className="underline" onClick={() => refetch()}>
          Try again
        </button>
      </p>
    )
  }

  if (!items.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Nothing delivered yet. Attempts appear here as soon as a message on this account reaches one
        of the events this endpoint subscribes to.
      </p>
    )
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} attempt{total === 1 ? "" : "s"}, newest first
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tries</TableHead>
              <TableHead className="text-right">Response</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell className="font-mono text-xs">{delivery.event}</TableCell>
                <TableCell>
                  <Badge variant={DELIVERY_TONE[delivery.status]}>{delivery.status}</Badge>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{delivery.attempts}</TableCell>
                {/* Kept even on success: a 2xx that isn't 200 is worth seeing. */}
                <TableCell className="text-right text-sm tabular-nums">
                  {delivery.responseStatus ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatWhen(delivery.sentAt ?? delivery.createdAt)}
                </TableCell>
                <TableCell className="max-w-[22rem] truncate text-xs text-muted-foreground">
                  {delivery.lastError ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * Webhook endpoints: URLs on the customer's own systems that we POST message
 * events to, so their software can react to a delivery or a failure without
 * polling us for the answer.
 *
 * The signing secret is shown once, at creation. Every read response omits it
 * by design on the backend, so there is nothing to reveal here later.
 */
export function WebhookEndpointsCard({ accountId }: { accountId: string | null | undefined }) {
  const { data, isLoading, error, refetch } = useWebhookEndpoints(accountId)
  const endpoints: WebhookEndpoint[] = Array.isArray(data) ? data : []
  // Separate from the empty case: a failed load rendering as "no endpoints" is
  // what gets someone to register a second copy of one they already have.
  const loadError = error ? getErrorMessage(error, "Couldn't load your webhook endpoints") : null

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<WebhookEventName[]>([...WEBHOOK_EVENT_NAMES])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedWebhookEndpoint | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const resetForm = () => {
    setName("")
    setUrl("")
    setEvents([...WEBHOOK_EVENT_NAMES])
    setCreateError(null)
  }

  const toggleEvent = (event: WebhookEventName, checked: boolean) => {
    setEvents((current) =>
      checked ? Array.from(new Set([...current, event])) : current.filter((e) => e !== event),
    )
  }

  const handleCreate = async () => {
    if (!accountId) return
    setCreateError(null)
    if (!name.trim()) {
      setCreateError("Give the endpoint a name so you can tell it apart later")
      return
    }
    // Checked here as well as on the backend so the message names the actual
    // rule while the form is still on screen, instead of arriving as a 400.
    if (!/^https:\/\//i.test(url.trim())) {
      setCreateError("The URL must start with https:// — plain http is refused")
      return
    }
    if (!events.length) {
      setCreateError("Pick at least one event, or the endpoint would never be called")
      return
    }
    setIsCreating(true)
    try {
      const endpoint = await createWebhookEndpoint({
        accountId,
        name: name.trim(),
        url: url.trim(),
        events,
      })
      setCreated(endpoint)
      setShowCreate(false)
      resetForm()
      refetch()
    } catch (err) {
      setCreateError(getErrorMessage(err) || "Failed to register endpoint")
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleActive = async (endpoint: WebhookEndpoint, active: boolean) => {
    if (!accountId) return
    setBusyId(endpoint.id)
    try {
      await updateWebhookEndpoint(endpoint.id, { accountId, active })
      toast.success(active ? "Endpoint resumed" : "Endpoint paused")
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't update the endpoint")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (endpoint: WebhookEndpoint) => {
    if (!accountId) return
    setBusyId(endpoint.id)
    try {
      await deleteWebhookEndpoint(endpoint.id, accountId)
      toast.success("Endpoint removed")
      if (expandedId === endpoint.id) setExpandedId(null)
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't remove the endpoint")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Webhook endpoints</CardTitle>
              <CardDescription>
                We POST to your URL the moment a message is sent, delivered, read or fails — so your
                systems can react without asking us repeatedly.
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreate(true)} disabled={!accountId}>
              <Plus className="mr-2 h-4 w-4" /> New endpoint
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : loadError ? (
            <EmptyState
              icon={Radio}
              title="Couldn't load your webhook endpoints"
              description={`${loadError}. Any endpoints you already have are still receiving events — don't register a replacement until this list loads.`}
              action={
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            />
          ) : endpoints.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No webhook endpoints yet"
              description="Register a URL to be told when your messages are delivered, read, or fail."
              hint="It has to be an https:// URL that answers 2xx. We retry a few times, then mark the delivery failed and keep the reason in its history."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((endpoint) => {
                    const state = health(endpoint)
                    const isExpanded = expandedId === endpoint.id
                    return (
                      <Fragment key={endpoint.id}>
                        <TableRow className={endpoint.active ? undefined : "opacity-60"}>
                          <TableCell className="font-medium">{endpoint.name}</TableCell>
                          <TableCell className="max-w-[18rem] truncate font-mono text-xs text-muted-foreground">
                            {endpoint.url}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {endpoint.events.length === WEBHOOK_EVENT_NAMES.length
                              ? "All"
                              : endpoint.events.map((e) => e.replace("message.", "")).join(", ")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={state.tone}>{state.label}</Badge>
                            {state.label === "Failing" && endpoint.lastError && (
                              <p className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground">
                                {endpoint.lastError}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={endpoint.active}
                              disabled={busyId === endpoint.id}
                              onCheckedChange={(checked) => handleToggleActive(endpoint, checked)}
                              aria-label={endpoint.active ? "Pause endpoint" : "Resume endpoint"}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : endpoint.id)}
                            >
                              {isExpanded ? "Hide history" : "History"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busyId === endpoint.id}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {busyId === endpoint.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    "Remove"
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove “{endpoint.name}”?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Events stop reaching this URL immediately and its signing secret
                                    stops being valid. The delivery history is kept, so you can still
                                    show what was sent. Registering the same URL again issues a new
                                    secret — pause it instead if you only want a break.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(endpoint)}>
                                    Remove endpoint
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                        {isExpanded && accountId && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/40 p-0">
                              <DeliveriesPanel accountId={accountId} endpointId={endpoint.id} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New webhook endpoint</DialogTitle>
            <DialogDescription>
              The signing secret is shown once, when the endpoint is created, and can&apos;t be
              looked up afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Order service"
              />
              <p className="text-xs text-muted-foreground">
                Only for you — it appears in this list and nowhere a customer sees.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/whatsapp-events"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                https only, and it can&apos;t carry a username or password in the URL — verify the
                signature instead of putting credentials in the address.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Events</Label>
              <div className="space-y-2.5 rounded-md border p-3">
                {WEBHOOK_EVENT_NAMES.map((event) => (
                  <label key={event} className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={events.includes(event)}
                      onCheckedChange={(checked) => toggleEvent(event, checked === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-mono text-xs">{event}</span>
                      <span className="block text-xs text-muted-foreground">
                        {EVENT_LABELS[event]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Register endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your signing secret now</DialogTitle>
            <DialogDescription>
              This is the only time the secret for “{created?.name}” can be read — no other request
              returns it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={created?.secret ?? ""} className="font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                if (!created) return
                navigator.clipboard?.writeText(created.secret)
                toast.success("Secret copied")
              }}
            >
              Copy
            </Button>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              Every request carries <code className="rounded bg-muted px-1">x-webhook-signature</code>{" "}
              as <code className="rounded bg-muted px-1">t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>{" "}
              — an HMAC-SHA256 over{" "}
              <code className="rounded bg-muted px-1">&quot;&lt;t&gt;.&lt;raw body&gt;&quot;</code>{" "}
              keyed with this secret. Check it before trusting a payload: anyone who learns your URL
              can post to it otherwise.
            </p>
            <p>
              The event name arrives in <code className="rounded bg-muted px-1">x-webhook-event</code>{" "}
              and a per-attempt id in{" "}
              <code className="rounded bg-muted px-1">x-webhook-delivery</code>. A retry repeats that
              id, so key on it rather than acting twice.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
