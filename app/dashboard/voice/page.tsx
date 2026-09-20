"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Pencil, Phone, PhoneCall, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { DataTable, type Column } from "@/components/data-table"
import { VoiceAgentDialog } from "@/components/voice/voice-agent-dialog"
import { VoiceCallPanel } from "@/components/voice/voice-call-panel"
import { VoiceCallDetails } from "@/components/voice/voice-call-details"
import { useAccountId } from "@/hooks/use-account-id"
import { useVoiceAgents, useVoiceCalls, useWhatsappPhoneNumbers } from "@/hooks/use-queries"
import { getErrorMessage } from "@/lib/errors"
import { formatCallDuration, formatVoiceCharge, voiceCallOutcome, voiceLanguageLabel } from "@/lib/voice"
import { deleteVoiceAgent, type VoiceAgent, type VoiceCall } from "@/services/api"

/**
 * Voice agents: what they are, a way to hear one, and what happened on past
 * calls.
 *
 * The test call is the point of this page. A voice agent cannot be judged from
 * its configuration — only from hearing it answer — and doing that over
 * WhatsApp needs a number on a high enough tier, calling enabled at Meta, and
 * a publicly reachable audio host. From the browser it needs none of that.
 */
export default function VoicePage() {
  const { accountId, resolved } = useAccountId()
  const agentsQuery = useVoiceAgents(accountId)
  const phoneNumbersQuery = useWhatsappPhoneNumbers(accountId)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const callsQuery = useVoiceCalls(accountId, { limit: 20 })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VoiceAgent | null>(null)
  const [deleting, setDeleting] = useState<VoiceAgent | null>(null)
  const [openCallId, setOpenCallId] = useState<string | null>(null)

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data])
  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) ?? agents.find((a) => a.active) ?? agents[0] ?? null

  // Keep the selection on something that still exists after a delete.
  useEffect(() => {
    if (selectedAgentId && !agents.some((a) => a.id === selectedAgentId)) setSelectedAgentId(null)
  }, [agents, selectedAgentId])

  const confirmDelete = async () => {
    if (!deleting || !accountId) return
    try {
      await deleteVoiceAgent(deleting.id, accountId)
      toast.success("Agent deleted")
      setDeleting(null)
      await agentsQuery.refetch()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Could not delete the agent")
    }
  }

  const callColumns: Column<VoiceCall>[] = [
    {
      key: "createdAt",
      header: "When",
      cell: (call: VoiceCall) => new Date(call.createdAt).toLocaleString(),
    },
    {
      key: "channel",
      header: "Channel",
      cell: (call: VoiceCall) => (
        <span className="capitalize">
          {call.channel === "whatsapp" ? "WhatsApp" : "Browser"}
          {call.callerWaId ? ` · ${call.callerName ?? call.callerWaId}` : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Outcome",
      cell: (call: VoiceCall) => {
        const outcome = voiceCallOutcome(call)
        return (
          <Badge
            variant={
              outcome.tone === "bad"
                ? "destructive"
                : outcome.tone === "good"
                  ? "default"
                  : "outline"
            }
          >
            {outcome.label}
          </Badge>
        )
      },
    },
    {
      key: "durationSeconds",
      header: "Talked",
      cell: (call: VoiceCall) => formatCallDuration(call.durationSeconds),
    },
    {
      key: "chargeMicros",
      header: "Charged",
      cell: (call: VoiceCall) => formatVoiceCharge(call.chargeMicros),
    },
    {
      key: "id",
      header: "",
      cell: (call: VoiceCall) => (
        <Button variant="ghost" size="sm" onClick={() => setOpenCallId(call.id)}>
          Transcript
        </Button>
      ),
    },
  ]

  if (!resolved || agentsQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!accountId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="No account connected"
          description="Connect a WhatsApp account first — voice agents belong to one."
        />
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader
        icon={<PhoneCall className="h-6 w-6 text-muted-foreground" />}
        title="Voice agents"
        description="An AI assistant that answers and makes calls. Test one here before it takes a real call."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void agentsQuery.refetch()
                void callsQuery.refetch()
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New agent
            </Button>
          </div>
        }
      />

      {agentsQuery.error && (
        <div className="mb-4 flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{getErrorMessage(agentsQuery.error)}</span>
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No voice agents yet"
          description="A voice agent answers calls in the language you choose, using instructions you write."
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create one
            </Button>
          }
          hint="You can talk to it from this page straight away — no phone number needed."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className={
                  agent.id === selectedAgent?.id ? "border-primary/60" : "cursor-pointer"
                }
                onClick={() => setSelectedAgentId(agent.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{voiceLanguageLabel(agent.language)}</Badge>
                        {agent.whatsappPhoneNumberId ? (
                          <Badge variant="outline">Answers WhatsApp calls</Badge>
                        ) : null}
                        {!agent.active && <Badge variant="destructive">Disabled</Badge>}
                        {agent.tools.length > 0 && (
                          <span className="text-xs">
                            {agent.tools.length} tool{agent.tools.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit agent"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(agent)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete agent"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleting(agent)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="line-clamp-2 text-sm text-muted-foreground">{agent.systemPrompt}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            {selectedAgent && (
              <VoiceCallPanel
                accountId={accountId}
                agent={selectedAgent}
                onCallEnded={() => void callsQuery.refetch()}
              />
            )}
          </div>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent calls</CardTitle>
          <CardDescription>
            Browser tests and real WhatsApp calls. Outcome and charge are written when a call ends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {callsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (callsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            <DataTable
              columns={callColumns}
              rows={callsQuery.data?.items ?? []}
              getRowKey={(call) => call.id}
            />
          )}
        </CardContent>
      </Card>

      <VoiceAgentDialog
        accountId={accountId}
        agent={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void agentsQuery.refetch()}
        phoneNumbers={phoneNumbersQuery.data ?? []}
      />

      <VoiceCallDetails
        accountId={accountId}
        callId={openCallId}
        onOpenChange={(open) => !open && setOpenCallId(null)}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Past calls and their transcripts are kept — each one holds its own copy of the
              agent&apos;s settings. Any WhatsApp number it answers stops being answered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
