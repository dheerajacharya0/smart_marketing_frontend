"use client"

import { Loader2, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useVoiceCall as useVoiceCallQuery } from "@/hooks/use-queries"
import { formatCallDuration, formatVoiceCharge, voiceCallOutcome } from "@/lib/voice"

interface Props {
  accountId: string
  callId: string | null
  onOpenChange: (open: boolean) => void
}

/** One call: how it went, what was said, and what it cost. */
export function VoiceCallDetails({ accountId, callId, onOpenChange }: Props) {
  const { data: call, isLoading } = useVoiceCallQuery(accountId, callId)

  return (
    <Dialog open={Boolean(callId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Call transcript</DialogTitle>
          <DialogDescription>
            {call
              ? `${call.channel === "whatsapp" ? "WhatsApp" : "Browser"} · ${
                  call.direction === "outbound" ? "we called" : "they called"
                }`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the call…
          </div>
        )}

        {call && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{voiceCallOutcome(call).label}</Badge>
              <span className="text-muted-foreground">
                {formatCallDuration(call.durationSeconds)} talked
              </span>
              {call.billedSeconds != null && (
                <span className="text-muted-foreground">
                  · {formatVoiceCharge(call.chargeMicros)} charged
                </span>
              )}
              {call.providers?.stt && (
                <span className="text-muted-foreground">
                  · {call.providers.stt} → {call.providers.llm} → {call.providers.tts}
                </span>
              )}
            </div>

            {call.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                {call.error}
              </p>
            )}

            {call.handoff && (
              <div className="rounded-md border p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <UserRound className="h-4 w-4" /> Handed to a human
                </p>
                <p className="mt-1">{call.handoff.reason}</p>
                {call.handoff.summary && (
                  <p className="mt-1 text-muted-foreground">{call.handoff.summary}</p>
                )}
              </div>
            )}

            {call.transcript.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing was said on this call.
              </p>
            ) : (
              <div className="space-y-2">
                {call.transcript.map((turn, i) => (
                  <div
                    key={`${turn.at}-${i}`}
                    className={
                      turn.role === "assistant"
                        ? "rounded-md bg-muted/60 p-3 text-sm"
                        : "rounded-md border p-3 text-sm"
                    }
                  >
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {turn.role === "assistant" ? "Agent" : "Caller"}
                      {turn.interrupted && " · interrupted"}
                    </p>
                    <p>{turn.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
