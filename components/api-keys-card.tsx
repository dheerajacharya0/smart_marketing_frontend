"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Explain } from "@/components/explain"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKey,
  type ApiKeyTier,
  type CreatedApiKey,
} from "@/services/api"

/** Per-minute ceilings, mirrored from the backend's tier table. */
const TIERS: { value: ApiKeyTier; label: string; perMin: number }[] = [
  { value: "free", label: "Free", perMin: 60 },
  { value: "starter", label: "Starter", perMin: 300 },
  { value: "pro", label: "Pro", perMin: 1200 },
  { value: "enterprise", label: "Enterprise", perMin: 6000 },
]

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * API keys for calling this product from a customer's own systems.
 *
 * The key itself is shown once, at creation, and never again — only its hash is
 * stored. Everything else here is deliberately reversible-looking but isn't:
 * revoking keeps the row so the key's usage history survives it.
 */
export function ApiKeysCard({
  accountId,
  onKeysChanged,
}: {
  accountId: string | null | undefined
  onKeysChanged?: () => void
}) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [tier, setTier] = useState<ApiKeyTier>("free")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchKeys = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const res = await listApiKeys(accountId)
      setKeys(Array.isArray(res) ? res : [])
    } catch {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async () => {
    if (!accountId) return
    setCreateError(null)
    if (!name.trim()) {
      setCreateError("Give the key a name so you can tell it apart later")
      return
    }
    setIsCreating(true)
    try {
      const key = await createApiKey({ accountId, name: name.trim(), tier })
      setCreated(key)
      setShowCreate(false)
      setName("")
      setTier("free")
      fetchKeys()
      onKeysChanged?.()
    } catch (err) {
      setCreateError(getErrorMessage(err) || "Failed to create key")
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevoke = async (key: ApiKey) => {
    if (!accountId) return
    setRevokingId(key.id)
    try {
      await revokeApiKey(key.id, accountId)
      toast.success("Key revoked")
      fetchKeys()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to revoke key")
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <Explain term="api-key">API keys</Explain>
              </CardTitle>
              <CardDescription>
                For calling this product from your own systems — reporting sales, sending messages,
                syncing contacts.
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreate(true)} disabled={!accountId}>
              <Plus className="mr-2 h-4 w-4" /> New key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              description="Create one to let your store or CRM talk to this account."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Rate limit</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} className={key.revokedAt ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">
                        {key.name}
                        {key.revokedAt && (
                          <Badge variant="secondary" className="ml-2">
                            Revoked
                          </Badge>
                        )}
                      </TableCell>
                      {/* The prefix is enough to recognise a key in a log; the
                          rest of it exists nowhere we can read. */}
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {key.prefix}…
                      </TableCell>
                      <TableCell className="text-sm capitalize">{key.tier}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {key.rateLimitPerMin}/min
                        {key.rateLimitOverride != null && (
                          <span className="ml-1 text-xs text-muted-foreground">(custom)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(key.lastUsedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {key.revokedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(key.revokedAt)}
                          </span>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={revokingId === key.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {revokingId === key.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Revoke"
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke “{key.name}”?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Anything using this key stops working immediately. The key is kept
                                  as a revoked record so its request history stays readable — it
                                  can&apos;t be un-revoked, so you&apos;ll need a new key to
                                  reconnect.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevoke(key)}>
                                  Revoke key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open)
        if (!open) {
          setName("")
          setCreateError(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>
              The key is shown once when it&apos;s created and can&apos;t be looked up afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shopify store"
              />
              <p className="text-xs text-muted-foreground">
                Only for you — it appears in this list and nowhere a customer sees.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as ApiKeyTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — {t.perMin} requests/min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your key now</DialogTitle>
            <DialogDescription>
              This is the only time “{created?.name}” can be read. We store a hash of it, so if
              it&apos;s lost you&apos;ll have to revoke it and create another.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={created?.key ?? ""} className="font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                if (!created) return
                navigator.clipboard?.writeText(created.key)
                toast.success("Key copied")
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send it as <code className="rounded bg-muted px-1">x-api-key</code> on your requests.
            Treat it like a password: anyone holding it can act on this account.
          </p>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
