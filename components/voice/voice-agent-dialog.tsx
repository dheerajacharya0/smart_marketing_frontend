"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getErrorMessage } from "@/lib/errors"
import {
  createVoiceAgent,
  updateVoiceAgent,
  VOICE_LANGUAGES,
  VOICE_TOOLS,
  type VoiceAgent,
  type WhatsappPhoneNumber,
} from "@/services/api"

const NO_NUMBER = "none"

interface Props {
  accountId: string
  /** Null creates a new agent. */
  agent: VoiceAgent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  phoneNumbers: WhatsappPhoneNumber[]
}

/**
 * Create or edit a voice agent. Everything here is what the agent *is* — the
 * live call reads this once when it starts, so an edit never changes a call
 * that is already in progress.
 */
export function VoiceAgentDialog({
  accountId,
  agent,
  open,
  onOpenChange,
  onSaved,
  phoneNumbers,
}: Props) {
  const [name, setName] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [firstMessage, setFirstMessage] = useState("")
  const [language, setLanguage] = useState("hi-IN")
  const [phoneNumberId, setPhoneNumberId] = useState<string>(NO_NUMBER)
  const [tools, setTools] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(agent?.name ?? "")
    setSystemPrompt(agent?.systemPrompt ?? "")
    setFirstMessage(agent?.firstMessage ?? "")
    setLanguage(agent?.language ?? "hi-IN")
    setPhoneNumberId(agent?.whatsappPhoneNumberId ?? NO_NUMBER)
    setTools(agent?.tools ?? [])
  }, [open, agent])

  const toggleTool = (tool: string, checked: boolean) =>
    setTools((current) =>
      checked ? [...new Set([...current, tool])] : current.filter((t) => t !== tool)
    )

  const save = async () => {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("A name and instructions are required")
      return
    }
    setSaving(true)
    try {
      const payload = {
        accountId,
        name: name.trim(),
        systemPrompt: systemPrompt.trim(),
        firstMessage: firstMessage.trim() || null,
        language,
        whatsappPhoneNumberId: phoneNumberId === NO_NUMBER ? null : phoneNumberId,
        tools,
      }
      if (agent) await updateVoiceAgent(agent.id, payload)
      else await createVoiceAgent(payload)
      toast.success(agent ? "Agent updated" : "Agent created")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Could not save the agent")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit voice agent" : "New voice agent"}</DialogTitle>
          <DialogDescription>
            What it says, what language it speaks, and what it may do during a call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice-agent-name">Name</Label>
            <Input
              id="voice-agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Support line"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-agent-prompt">Instructions</Label>
            <Textarea
              id="voice-agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="You answer calls for Acme. Help with orders, delivery and pricing. If you cannot help, hand off to a human."
            />
            <p className="text-xs text-muted-foreground">
              Rules for speaking aloud (no markdown, short replies, mirror the caller&apos;s
              language) are added automatically.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voice-agent-language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="voice-agent-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice-agent-number">Answer WhatsApp calls on</Label>
              <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
                <SelectTrigger id="voice-agent-number">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_NUMBER}>No number (browser calls only)</SelectItem>
                  {phoneNumbers.map((p) => (
                    <SelectItem key={p.phoneNumberId} value={p.phoneNumberId}>
                      {p.displayPhoneNumber || p.phoneNumberId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                One number rings one agent. Calling must also be enabled on the number at Meta.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-agent-first-message">First thing it says</Label>
            <Input
              id="voice-agent-first-message"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Namaste! Main aapki kya madad kar sakta hoon?"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to let the agent open in its own words — costs a moment of silence first.
            </p>
          </div>

          <div className="space-y-2">
            <Label>What it may do</Label>
            <div className="space-y-2 rounded-md border p-3">
              {VOICE_TOOLS.map((tool) => (
                <label key={tool.name} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={tools.includes(tool.name)}
                    onCheckedChange={(checked) => toggleTool(tool.name, checked === true)}
                    aria-label={tool.label}
                  />
                  <span>
                    <span className="font-medium">{tool.label}</span>
                    <span className="block text-xs text-muted-foreground">{tool.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {agent ? "Save changes" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
