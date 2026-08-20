"use client"

import { useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "react-hot-toast"
import { listWhatsappTemplates, sendWhatsappTemplate, type WhatsappTemplate } from "@/services/api"
import { useWhatsappConversations, type Conversation } from "@/hooks/use-whatsapp-conversations"
import {
  getTemplateParamGroups,
  buildSendTemplateComponents,
  allTemplateParamsFilled,
  emptyTemplateParamValues,
  type TemplateParamValues,
} from "@/lib/whatsapp-template"

const POLL_ATTEMPTS = 6
const POLL_INTERVAL_MS = 1500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function NewChatPage() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [paramValues, setParamValues] = useState<TemplateParamValues>(emptyTemplateParamValues())
  const [isSending, setIsSending] = useState(false)

  const { context, refetchConversations } = useWhatsappConversations()

  const template = templates.find((t) => t.name === selectedTemplate)
  const paramGroups = template ? getTemplateParamGroups(template) : []

  useEffect(() => {
    if (!context) return
    listWhatsappTemplates(context.accountId, context.wabaId)
      .then((response) => {
        setTemplates(Array.isArray(response) ? response.filter((t) => t.status === "APPROVED") : [])
      })
      .catch((err) => console.error("Failed to load templates:", err))
  }, [context])

  const handleStart = async () => {
    const digitsOnly = phoneNumber.replace(/\D/g, "")
    if (!digitsOnly || !selectedTemplate || !context || !template) return
    if (!allTemplateParamsFilled(paramGroups, paramValues)) {
      toast.error("Fill in all template variables before sending")
      return
    }

    setIsSending(true)
    try {
      await sendWhatsappTemplate({
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        to: digitsOnly,
        templateName: template.name,
        languageCode: template.language ?? "en_US",
        components: buildSendTemplateComponents(paramGroups, paramValues),
      })
      toast.success("Template sent")

      // No "create conversation" endpoint — the backend creates the conversation
      // row once the send lands, so poll the list briefly for it to show up.
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        const list = await refetchConversations()
        const match = list?.find((c: Conversation) => c.contactWaId === digitsOnly)
        if (match) {
          router.push(`/dashboard/chat/${match.id}`)
          return
        }
        await sleep(POLL_INTERVAL_MS)
      }
      toast("Conversation will appear in the list shortly", { icon: "⏳" })
      router.push("/dashboard/chat")
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to send template")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="container mx-auto p-6 h-full flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-2">
            <MessageCircle className="h-8 w-8 text-success" />
          </div>
          <CardTitle className="text-2xl">Start New Chat</CardTitle>
          <CardDescription>
            New contacts are outside the 24h window, so the first message has to be an approved template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-chat-phone">Phone Number</Label>
            <Input
              id="new-chat-phone"
              placeholder="919876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Country code, no spaces or symbols (e.g. 919876543210).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={selectedTemplate}
              onValueChange={(name) => {
                setSelectedTemplate(name)
                setParamValues(emptyTemplateParamValues())
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={templates.length ? "Select a template" : "No approved templates yet"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Create and get a template approved first, under WhatsApp Business → Templates.
              </p>
            )}
          </div>

          {paramGroups.map((group) => (
            <div key={group.type} className="space-y-2 p-3 border rounded-md">
              <Label className="capitalize">{group.type} variables</Label>
              {group.tokens.map((tok, i) => (
                <Input
                  key={tok}
                  value={paramValues[group.type]?.[tok] || ""}
                  onChange={(e) =>
                    setParamValues({ ...paramValues, [group.type]: { ...paramValues[group.type], [tok]: e.target.value } })
                  }
                  placeholder={group.examples[i] ? `e.g. ${group.examples[i]}` : `Value for {{${tok}}}`}
                />
              ))}
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={handleStart}
            disabled={
              !phoneNumber.trim() ||
              !selectedTemplate ||
              isSending ||
              !allTemplateParamsFilled(paramGroups, paramValues)
            }
          >
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send & Start Chat
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
