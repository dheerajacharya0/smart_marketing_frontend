"use client"

import { AlertCircle, Loader2, Mic, PhoneOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useVoiceCall } from "@/hooks/use-voice-call"
import { voiceStageLabel } from "@/lib/voice"
import type { VoiceAgent } from "@/services/api"

interface Props {
  accountId: string
  agent: VoiceAgent
  /** Called when a call ends, so the caller can refresh the call list. */
  onCallEnded: (callId: string | null) => void
}

/**
 * Talk to an agent from the browser — the quickest way to hear what a customer
 * would hear, without WhatsApp, a phone, or Meta being involved at all.
 *
 * The microphone is released the moment the call ends or this unmounts; a
 * dashboard that keeps a mic open after a call is over is its own problem.
 */
export function VoiceCallPanel({ accountId, agent, onCallEnded }: Props) {
  const call = useVoiceCall(accountId)
  const live = call.stage === "connected" || call.stage === "connecting"

  const hangUp = () => {
    call.hangUp()
    onCallEnded(call.callId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test call</CardTitle>
        <CardDescription>
          Speak to <span className="font-medium">{agent.name}</span> from this browser. Nothing is
          sent over WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          {live ? (
            <Button variant="destructive" onClick={hangUp}>
              <PhoneOff className="mr-2 h-4 w-4" />
              Hang up
            </Button>
          ) : (
            <Button onClick={() => void call.start(agent.id)} disabled={call.busy || !agent.active}>
              {call.busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              Start call
            </Button>
          )}
          <span
            className={
              call.stage === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
            }
          >
            {voiceStageLabel(call.stage)}
          </span>
        </div>

        {!agent.active && (
          <p className="text-sm text-muted-foreground">
            This agent is disabled, so it will not take calls.
          </p>
        )}

        {call.error && (
          <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{call.error}</span>
          </div>
        )}

        {/* The agent's voice. Muted would defeat the purpose; autoPlay is
            allowed here because the call started from a click. */}
        <audio ref={call.audioRef} autoPlay className="hidden" />
      </CardContent>
    </Card>
  )
}
