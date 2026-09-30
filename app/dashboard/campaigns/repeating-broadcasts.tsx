"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp, Loader2, PauseCircle, PlayCircle, Repeat, XCircle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { getErrorMessage } from "@/lib/errors"
import { queryKeys, useCampaignSeries } from "@/hooks/use-queries"
import {
  skipCampaignSeriesRun,
  updateCampaignSeries,
  type CampaignSeries,
  type CampaignSeriesRunStatus,
  type CampaignSeriesStatus,
} from "@/services/api"

const SERIES_BADGE: Record<CampaignSeriesStatus, { label: string; className: string }> = {
  active: { label: "Repeating", className: "bg-info-soft text-info hover:bg-info-soft" },
  paused: { label: "Paused", className: "bg-warning-soft text-warning hover:bg-warning-soft" },
  completed: { label: "Finished", className: "bg-success-soft text-success hover:bg-success-soft" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground hover:bg-muted" },
}

const RUN_LABEL: Record<CampaignSeriesRunStatus, string> = {
  pending: "Planned",
  sent: "Sent",
  skipped: "Skipped",
  missed: "Missed",
  failed: "Failed",
  cancelled: "Cancelled",
}

const RUN_TONE: Record<CampaignSeriesRunStatus, string> = {
  pending: "text-foreground",
  sent: "text-success",
  skipped: "text-muted-foreground",
  missed: "text-warning",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Repeating broadcasts on the campaigns page: what each one is doing, when it
 * sends next, and every planned send with its outcome. Each send that went out
 * is an ordinary campaign, linked from its row, so delivery and replies are
 * read where they always are.
 */
export function RepeatingBroadcasts({ accountId }: { accountId: string }) {
  const { data } = useCampaignSeries(accountId)
  const series = Array.isArray(data) ? data : []
  if (series.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4" /> Repeating broadcasts
        </CardTitle>
        <CardDescription>
          Each send picks its audience at its own time and appears below as its own campaign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {series.map((s) => (
          <SeriesRow key={s.id} series={s} accountId={accountId} />
        ))}
      </CardContent>
    </Card>
  )
}

function SeriesRow({ series, accountId }: { series: CampaignSeries; accountId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const badge = SERIES_BADGE[series.status]
  const total = series.runs.length
  const live = series.status === "active" || series.status === "paused"

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaignSeries(accountId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns(accountId) })
  }

  const act = async (action: "pause" | "resume" | "cancel") => {
    setBusy(action)
    try {
      await updateCampaignSeries(series.id, accountId, action)
      toast.success(
        action === "pause"
          ? "Paused — planned sends wait until you resume"
          : action === "resume"
            ? "Resumed"
            : "Cancelled — no more sends from this series"
      )
      refresh()
    } catch (err) {
      toast.error(getErrorMessage(err) || `Couldn't ${action} it`)
    } finally {
      setBusy(null)
    }
  }

  const skip = async (runId: string) => {
    setBusy(runId)
    try {
      await skipCampaignSeriesRun(series.id, runId, accountId)
      toast.success("That send is skipped; the rest carry on")
      refresh()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Couldn't skip it")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{series.name}</span>
            <Badge className={badge.className}>{badge.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {series.templateName} to{" "}
            {series.audienceTag ? `contacts tagged ${series.audienceTag}` : series.segmentId ? "a segment" : "all opted-in contacts"}
            {" · "}
            <span className="font-mono tabular-nums">
              {series.sentCount}/{total}
            </span>{" "}
            sent
            {series.nextRunAt && live && <> · next {when(series.nextRunAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {series.status === "active" && (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act("pause")}>
              {busy === "pause" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-1 h-4 w-4" />}
              Pause
            </Button>
          )}
          {series.status === "paused" && (
            <Button size="sm" disabled={!!busy} onClick={() => act("resume")}>
              {busy === "resume" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-1 h-4 w-4" />}
              Resume
            </Button>
          )}
          {live && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!!busy} className="text-destructive hover:text-destructive">
                  <XCircle className="mr-1 h-4 w-4" /> Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop &quot;{series.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every send still planned is cancelled. Sends that already went out are unaffected.
                    This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={() => act("cancel")}>Stop repeating</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Hide planned sends" : "Show planned sends"}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1">Sends</span>
          </Button>
        </div>
      </div>

      {open && (
        <ul className="divide-y border-t text-sm">
          {series.runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="w-40 shrink-0 font-mono text-xs tabular-nums">{when(run.runAt)}</span>
              <span className={`w-20 shrink-0 text-xs font-medium ${RUN_TONE[run.status]}`}>
                {RUN_LABEL[run.status]}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={run.error ?? undefined}>
                {run.status === "skipped" && run.error?.includes("empty")
                  ? "Nobody in the audience that day"
                  : (run.error ?? "")}
              </span>
              {run.campaignId && (
                <Button asChild size="sm" variant="link" className="h-7 px-0">
                  <Link href={`/dashboard/campaigns/${run.campaignId}`}>View campaign</Link>
                </Button>
              )}
              {run.status === "pending" && live && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  disabled={!!busy}
                  onClick={() => skip(run.id)}
                >
                  {busy === run.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Skip
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
