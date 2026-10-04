"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileStack, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Explain } from "@/components/explain"
import { useWhatsappFlows } from "@/hooks/use-queries"
import { swallow } from "@/lib/observability"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import {
  deleteWhatsappFlow,
  getActiveWhatsappContext,
  syncWhatsappFlow,
  type WhatsappContext,
  type WhatsappFlow,
} from "@/services/api"
import { FlowStatusBadge } from "./flow-status-badge"
import { NewFlowDialog } from "./new-flow-dialog"

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Meta WhatsApp Flows — forms that open inside WhatsApp.
 *
 * A different product from `/dashboard/flows` (our own chatbot engine), and the
 * page says so up front: two things called "flows" in one sidebar is a support
 * ticket waiting to happen.
 */
export default function WhatsappFlowsPage() {
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const { data, isLoading, error, refetch } = useWhatsappFlows(context?.accountId)
  // The backend lists every form on the account, but a form lives on one WABA
  // and only that WABA's numbers can send it. Show the active number's.
  const flows: WhatsappFlow[] = Array.isArray(data)
    ? data.filter((f) => !context?.wabaId || f.wabaId === context.wabaId)
    : []
  const loadError = error ? getErrorMessage(error, "Couldn't load forms") : null
  const [showNew, setShowNew] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchFlows = useCallback(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    getActiveWhatsappContext()
      .then(setContext)
      .catch(swallow("app/dashboard/whatsapp-flows/page.tsx"))
  }, [])

  const handleSync = async (flow: WhatsappFlow) => {
    if (!context) return
    setBusyId(flow.id)
    try {
      const updated = await syncWhatsappFlow(flow.id, context.accountId)
      refetch()
      toast.success(`Meta says: ${updated.status.toLowerCase()}`)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Sync failed")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (flow: WhatsappFlow) => {
    if (!context) return
    setBusyId(flow.id)
    try {
      await deleteWhatsappFlow(flow.id, context.accountId)
      toast.success("Form deleted")
      fetchFlows()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't delete this form")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Forms"
        description={
          <>
            <Explain term="whatsapp-flow">Forms that open inside WhatsApp</Explain> — sign-ups,
            bookings, lead capture. Designed and approved by Meta, sent from here.
          </>
        }
        actions={
          <Button onClick={() => setShowNew(true)} disabled={!context}>
            <Plus className="mr-2 h-4 w-4" /> New form
          </Button>
        }
      />

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p>
          Not the same as{" "}
          <Link href="/dashboard/flows" className="underline underline-offset-4">
            Chatbot flows
          </Link>
          . A chatbot flow is a back-and-forth in ordinary messages; this is a form Meta renders
          inside the WhatsApp app, with fields the contact fills in and submits in one go.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your forms</CardTitle>
          <CardDescription>
            Meta owns the status. Publishing freezes a form&apos;s design permanently, and Meta can
            throttle or block one without telling us — Sync re-reads it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : loadError ? (
                  // Meta owns these forms; a list that didn't load says nothing
                  // about whether they're still published and collecting.
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <p className="text-sm text-muted-foreground">{loadError}</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={fetchFlows}>
                        Try again
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : !context ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Connect a WhatsApp number first.
                    </TableCell>
                  </TableRow>
                ) : flows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={FileStack}
                        title="No forms yet"
                        description="Create one, upload its design, then publish it to Meta before sending."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  flows.map((flow) => (
                    <TableRow key={flow.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/whatsapp-flows/${flow.id}`}
                          className="hover:underline"
                        >
                          {flow.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <FlowStatusBadge status={flow.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {flow.categories.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs">
                              {c.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(flow.publishedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(flow.lastSyncedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Re-read status from Meta"
                            disabled={busyId === flow.id}
                            onClick={() => handleSync(flow)}
                          >
                            {busyId === flow.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={busyId === flow.id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete &ldquo;{flow.name}&rdquo;?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the form from Meta too. Submissions already received
                                  are kept — they&apos;re your data, not the form&apos;s.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(flow)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {context && (
        <NewFlowDialog
          open={showNew}
          onOpenChange={setShowNew}
          context={context}
          onCreated={() => fetchFlows()}
        />
      )}
    </div>
  )
}
