"use client"

import { useState } from "react"
import { Loader2, PhoneOutgoing, Search, Send } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/errors"
import { describeCallPermission } from "@/lib/voice"
import {
  getVoiceCallPermission,
  requestVoiceCallPermission,
  type VoiceAgent,
  type VoiceCallPermission,
} from "@/services/api"

interface Props {
  accountId: string
  /** The agent whose WhatsApp number would place the call. */
  agent: VoiceAgent
}

/**
 * Whether one person has agreed to be called, and the prompt that asks them.
 *
 * WhatsApp is not a phone line: a business may only call someone who has
 * explicitly accepted, for seven days or permanently, and the request itself
 * only sends inside the 24-hour window after they last messaged. The status
 * is read from Meta each time rather than from our copy, because Meta revokes
 * a grant on its own (four unanswered calls, or the seven days lapsing) and
 * tells nobody when it does.
 */
export function VoiceCallPermissionCard({ accountId, agent }: Props) {
  const [waId, setWaId] = useState("")
  const [permission, setPermission] = useState<VoiceCallPermission | null>(null)
  const [checking, setChecking] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const phoneNumberId = agent.whatsappPhoneNumberId
  const digits = waId.replace(/[^\d]/g, "")

  if (!phoneNumberId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call permission</CardTitle>
          <CardDescription>
            Assign a WhatsApp number to this agent to call people from it.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const check = async () => {
    setChecking(true)
    setPermission(null)
    try {
      setPermission(
        await getVoiceCallPermission({ accountId, phoneNumberId, waId: digits })
      )
    } catch (err) {
      toast.error(getErrorMessage(err) || "Could not read the permission")
    } finally {
      setChecking(false)
    }
  }

  const request = async () => {
    setRequesting(true)
    try {
      await requestVoiceCallPermission({ accountId, phoneNumberId, waId: digits })
      toast.success("Request sent — they answer it in WhatsApp")
      // Their answer arrives by webhook, so this stays "no permission" until
      // they tap accept. Re-check rather than guess.
      await check()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Could not send the request")
    } finally {
      setRequesting(false)
    }
  }

  const described = permission ? describeCallPermission(permission) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Call permission</CardTitle>
        <CardDescription>
          You can only call someone on WhatsApp after they agree to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="voice-permission-number">Their WhatsApp number</Label>
          <Input
            id="voice-permission-number"
            value={waId}
            onChange={(e) => setWaId(e.target.value)}
            placeholder="919812345678"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            Country code first, digits only.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={check}
            disabled={digits.length < 8 || checking}
          >
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Check status
          </Button>
          <Button
            size="sm"
            onClick={request}
            disabled={digits.length < 8 || requesting || permission?.canCall}
          >
            {requesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Ask for permission
          </Button>
        </div>

        {described && (
          <div className="space-y-1 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Badge variant={described.tone === "good" ? "default" : "outline"}>
                {described.label}
              </Badge>
              {permission?.canCall && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PhoneOutgoing className="h-3 w-3" /> callable now
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{described.detail}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Meta allows one request per person per day and two per week, and withdraws permission
          after four unanswered calls.
        </p>
      </CardContent>
    </Card>
  )
}
