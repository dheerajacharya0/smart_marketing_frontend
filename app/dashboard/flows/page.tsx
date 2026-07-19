"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bot, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  listFlows,
  updateFlow,
  deleteFlow,
  type Flow,
  type WhatsappContext,
} from "@/services/api"

export default function FlowsPage() {
  const router = useRouter()
  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [flows, setFlows] = useState<Flow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext(user.id)
        setContext(ctx)
        if (!ctx) setIsLoading(false)
      } catch (err) {
        console.error("Failed to resolve WhatsApp context:", err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const fetchFlows = useCallback(async () => {
    if (!context) return
    setIsLoading(true)
    try {
      const res = await listFlows(context.accountId)
      setFlows(Array.isArray(res) ? res : [])
    } catch (err: any) {
      toast.error(err?.message || "Failed to load flows")
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])

  const handleToggleActive = async (flow: Flow, next: boolean) => {
    if (!context) return
    setBusyId(flow.id)
    try {
      await updateFlow(flow.id, { accountId: context.accountId, isActive: next })
      fetchFlows()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update flow")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (flow: Flow) => {
    if (!context) return
    setBusyId(flow.id)
    try {
      await deleteFlow(flow.id, context.accountId)
      toast.success("Flow deleted")
      fetchFlows()
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete flow")
    } finally {
      setBusyId(null)
    }
  }

  const triggerLabel = (flow: Flow) =>
    flow.triggerMatchType === "any"
      ? "Any message"
      : `${flow.triggerMatchType === "exact" ? "Exact" : "Contains"}: ${(flow.triggerKeywords || []).join(", ")}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbot Flows"
        description="Keyword-triggered bots that walk contacts through messages, buttons and questions."
        actions={
          <Button onClick={() => router.push("/dashboard/flows/new")} disabled={!context}>
            <Plus className="mr-2 h-4 w-4" /> New Flow
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Flows</CardTitle>
          <CardDescription>
            Lower priority number runs first when several flows could trigger; flows take priority over
            keyword auto-replies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && context && flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-accent p-3 mb-3">
                <Bot className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No flows yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md text-center">
                A flow is a stateful chatbot: a keyword starts it, then it sends messages, shows buttons,
                asks questions and can hand off to a human — all without you touching the inbox.
              </p>
              <Button onClick={() => router.push("/dashboard/flows/new")}>
                <Plus className="mr-2 h-4 w-4" /> New Flow
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Nodes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : !context ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No registered WhatsApp number yet — finish the WhatsApp setup flow first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    flows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell className="font-medium">
                          {flow.name}
                          {flow.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-56">{flow.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{triggerLabel(flow)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={flow.isActive}
                            disabled={busyId === flow.id}
                            onCheckedChange={(v) => handleToggleActive(flow, v)}
                          />
                        </TableCell>
                        <TableCell>{flow.priority}</TableCell>
                        <TableCell>{flow.definition?.nodes?.length ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Sessions" asChild>
                              <Link href={`/dashboard/flows/${flow.id}/sessions`}>
                                <Users className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" title="Edit" asChild>
                              <Link href={`/dashboard/flows/${flow.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete"
                                  disabled={busyId === flow.id}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{flow.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Active sessions stop immediately. This can't be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(flow)}>Delete</AlertDialogAction>
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
