"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, KeyRound, Loader2, RefreshCw, Send, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
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
import { getErrorMessage } from "@/lib/errors"
import {
  deprecateWhatsappFlow,
  getActiveWhatsappContext,
  publishWhatsappFlow,
  rotateFlowKey,
  syncWhatsappFlow,
  uploadWhatsappFlowDefinition,
  type WhatsappContext,
  type WhatsappFlow,
} from "@/services/api"
import { FlowStatusBadge, flowStatusHint } from "../flow-status-badge"
import { useQueryClient } from "@tanstack/react-query"
import { useWhatsappFlow, useFlowKeyStatus, queryKeys } from "@/hooks/use-queries"
import { reportSilent } from "@/lib/observability"
import { SendFlowDialog } from "../send-flow-dialog"
import { FlowResponsesTable } from "../flow-responses-table"

export default function WhatsappFlowDetailPage() {
  const params = useParams<{ flowId: string }>()
  const flowId = params.flowId
  const router = useRouter()

  const [context, setContext] = useState<WhatsappContext | null>(null)
  const [definitionText, setDefinitionText] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)

  const queryClient = useQueryClient()
  const {
    data: flow,
    isLoading,
    error: flowError,
    refetch: refetchFlow,
  } = useWhatsappFlow(context?.accountId, flowId)
  const loadError = flowError ? getErrorMessage(flowError, "Couldn't load this form") : null

  // Only a data_api form needs a keypair, so the query stays disabled for one
  // that never calls out — asking anyway would put an alarming "not configured"
  // panel on a form that has no endpoint.
  const { data: keyStatus } = useFlowKeyStatus(context?.accountId, context?.phoneNumberId, {
    enabled: Boolean(flow?.endpointUrl),
  })

  useEffect(() => {
    getActiveWhatsappContext()
      .then(setContext)
      .catch((err) =>
        reportSilent(err, {
          source: "app/dashboard/whatsapp-flows/[flowId]/page.tsx",
          step: "resolve-context",
        }),
      )
  }, [])

  // Seed the definition editor from the loaded form, keyed on the form itself
  // so a refetch can't overwrite an edit in progress.
  useEffect(() => {
    if (!flow) return
    setDefinitionText(flow.definition ? JSON.stringify(flow.definition, null, 2) : "")
  }, [flow])

  const run = async (label: string, fn: () => Promise<WhatsappFlow>) => {
    setBusy(label)
    try {
      const updated = await fn()
      // Written into the cache rather than a local copy: publish, deprecate and
      // sync all return the authoritative row, and Meta owns the status they
      // set — refetching to ask again would be slower and no more true.
      if (context) {
        queryClient.setQueryData(queryKeys.whatsappFlow(context.accountId, flowId), updated)
      }
      setDefinitionText(updated.definition ? JSON.stringify(updated.definition, null, 2) : "")
      return updated
    } catch (err) {
      toast.error(getErrorMessage(err) || `${label} failed`)
      return null
    } finally {
      setBusy(null)
    }
  }

  const handleUpload = async () => {
    if (!context) return
    let definition: Record<string, unknown>
    try {
      definition = JSON.parse(definitionText)
    } catch (err) {
      // Parsed here so a typo is caught before the round trip, and so the error
      // can say where — Meta's own message for malformed JSON names nothing.
      toast.error(`That JSON doesn't parse: ${(err as Error).message}`)
      return
    }
    const updated = await run("Upload", () =>
      uploadWhatsappFlowDefinition(flowId, context.accountId, definition)
    )
    if (updated) {
      toast.success(
        updated.validationErrors?.length
          ? "Uploaded, but Meta reported problems — see below"
          : "Design uploaded"
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Meta holds the form; a read that failed says nothing about whether it is
  // still published and collecting responses. "Form not found" would.
  if (loadError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/whatsapp-flows")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to forms
        </Button>
        <p className="text-muted-foreground">{loadError}</p>
        <Button variant="outline" onClick={() => refetchFlow()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!flow || !context) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/whatsapp-flows")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to forms
        </Button>
        <p className="text-muted-foreground">Form not found.</p>
      </div>
    )
  }

  const isDraft = flow.status === "DRAFT"
  const canSend = flow.status === "PUBLISHED" || isDraft

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/whatsapp-flows")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to forms
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{flow.name}</h2>
            <FlowStatusBadge status={flow.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                run("Sync", () => syncWhatsappFlow(flow.id, context.accountId)).then(
                  (updated) => updated && toast.success(`Meta says: ${updated.status.toLowerCase()}`)
                )
              }
            >
              {busy === "Sync" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync
            </Button>
            {canSend && (
              <Button onClick={() => setShowSend(true)}>
                <Send className="mr-2 h-4 w-4" /> Send to a contact
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{flowStatusHint(flow.status)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {flow.categories.map((c) => (
          <Badge key={c} variant="outline">
            {c.replace(/_/g, " ").toLowerCase()}
          </Badge>
        ))}
      </div>

      {flow.validationErrors && flow.validationErrors.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Meta rejected this design</CardTitle>
            <CardDescription>
              Reported when the design was uploaded. Fix these and upload again — it can&apos;t be
              published until Meta accepts it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(flow.validationErrors, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Design</CardTitle>
          <CardDescription>
            {isDraft
              ? "Meta's Flow JSON. Replace it as often as you need while this is a draft."
              : "Frozen. Publishing locks the design permanently — a change means a new form."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={definitionText}
            onChange={(e) => setDefinitionText(e.target.value)}
            rows={16}
            readOnly={!isDraft}
            className="font-mono text-xs"
            placeholder='{"version": "7.0", "screens": [...]}'
          />
          {isDraft && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleUpload} disabled={busy !== null || !definitionText.trim()}>
                {busy === "Upload" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload design
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={busy !== null || !flow.definition}>
                    Publish
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publish this form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Publishing is permanent: Meta freezes the design and it can never be edited
                      again. Changing anything afterwards means creating a new form and sending
                      that one instead. Send it to yourself as a draft first if you haven&apos;t
                      tried it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Not yet</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        run("Publish", () => publishWhatsappFlow(flow.id, context.accountId)).then(
                          (updated) => updated && toast.success("Published")
                        )
                      }
                    >
                      Publish permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {flow.status === "PUBLISHED" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy !== null}>
                  Retire this form
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retire this form?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It can no longer be sent, and this can&apos;t be undone. Submissions already
                    received are unaffected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it live</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run("Retire", () => deprecateWhatsappFlow(flow.id, context.accountId)).then(
                        (updated) => updated && toast.success("Retired")
                      )
                    }
                  >
                    Retire
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      {flow.endpointUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Endpoint encryption
            </CardTitle>
            <CardDescription>
              This form calls <span className="font-mono text-xs">{flow.endpointUrl}</span> for each
              screen. Meta encrypts those requests to a public key held for this phone number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {keyStatus?.configured ? (
              <>
                {keyStatus.uploadedAt ? (
                  <p className="text-sm">
                    Key in place and uploaded to Meta on{" "}
                    {new Date(keyStatus.uploadedAt).toLocaleDateString()}.
                  </p>
                ) : (
                  // The one failure mode worth shouting about: the pair exists
                  // locally but Meta still holds an older key, so every request
                  // fails to decrypt and the form dies mid-screen.
                  <p className="text-sm text-destructive">
                    A key exists here but Meta hasn&apos;t got it. Every request from this form will
                    fail to decrypt until it&apos;s uploaded — rotate to fix it.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No key set up for this number yet. This form won&apos;t work until there is one.
              </p>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy !== null}>
                  {keyStatus?.configured ? "Rotate key" : "Set up key"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {keyStatus?.configured ? "Rotate the encryption key?" : "Generate a key?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {keyStatus?.configured
                      ? "Anyone part-way through this form right now will break — Meta encrypted their session to the old key. Do this in a quiet window."
                      : "A keypair is generated here and the public half is sent to Meta. The private half never leaves the server."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setBusy("Key")
                      try {
                        // The rotate response is the new status; write it
                        // straight into the cache rather than asking again.
                        queryClient.setQueryData(
                          queryKeys.flowKeyStatus(context.accountId, context.phoneNumberId),
                          await rotateFlowKey(context.accountId, context.phoneNumberId),
                        )
                        toast.success("Key uploaded to Meta")
                      } catch (err) {
                        toast.error(getErrorMessage(err) || "Key setup failed")
                      } finally {
                        setBusy(null)
                      }
                    }}
                  >
                    {keyStatus?.configured ? "Rotate" : "Generate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      <FlowResponsesTable accountId={context.accountId} metaFlowId={flow.metaFlowId} />

      <SendFlowDialog
        open={showSend}
        onOpenChange={setShowSend}
        context={context}
        flow={flow}
      />
    </div>
  )
}
