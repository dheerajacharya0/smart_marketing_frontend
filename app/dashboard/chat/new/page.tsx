"use client"

import { useMemo, useState } from "react"
import { getErrorMessage, getFieldError } from "@/lib/errors"
import { PhoneNumberInput } from "@/components/phone-number-input"
import { checkRecipient } from "@/lib/phone-number"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MessageCircle, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { sendWhatsappTemplate, type WhatsappTemplate } from "@/services/api"
import { useWhatsappConversations, type Conversation } from "@/hooks/use-whatsapp-conversations"
import { ConversationChargeNote } from "@/components/cost-estimate"
import { TemplateMessagePreview } from "@/components/template-message-preview"
import { useWhatsappTemplates } from "@/hooks/use-queries"
import { NoApprovedTemplates, isTemplateInReview } from "@/components/no-approved-templates"
import {
  EMPTY_TEMPLATE_INPUTS,
  buildDirectSendComponents,
  fitTemplateInputs,
  previewValues,
  templateInputProblems,
  templateSpec,
  type TemplateInputValues,
} from "@/lib/template-spec"
import { TemplateInputsFields } from "@/components/whatsapp/template-inputs"
import { TemplateHeaderMediaField } from "@/components/template-header-media-field"
import type { TemplateHeaderMedia } from "@/services/api"

const POLL_ATTEMPTS = 6
const POLL_INTERVAL_MS = 1500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function NewChatPage() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [inputs, setInputs] = useState<TemplateInputValues>(EMPTY_TEMPLATE_INPUTS)
  const [headerMedia, setHeaderMedia] = useState<TemplateHeaderMedia | undefined>(undefined)
  const [isSending, setIsSending] = useState(false)

  const { context, refetchConversations } = useWhatsappConversations()

  // Shares the templates cache with the templates screen and the inbox
  // composer, so the approved list is fetched once per account rather than
  // once per screen that offers a template. While one is in Meta's review it
  // polls, so an approval lands in the dropdown without a reload.
  const { data: allTemplates, isLoading: templatesLoading } = useWhatsappTemplates(
    context?.accountId,
    context?.wabaId,
    { pollWhile: (rows) => rows.some(isTemplateInReview) },
  )
  const templates: WhatsappTemplate[] = useMemo(
    () => (Array.isArray(allTemplates) ? allTemplates.filter((t) => t.status === "APPROVED") : []),
    [allTemplates],
  )

  const template = templates.find((t) => t.name === selectedTemplate)
  // Everything the template takes; see lib/template-spec.ts.
  const spec = useMemo(() => templateSpec(template), [template])
  const problem = template ? (templateInputProblems(spec, inputs, headerMedia)[0] ?? null) : null

  const handleStart = async () => {
    setPhoneError(null)
    // Validated against the country's numbering plan, not just E.164's outer
    // bounds — a number one digit short is accepted by Meta and only fails on
    // a webhook seconds later, by which point the user has been told it sent.
    const recipient = checkRecipient(phoneNumber)
    if (!recipient.valid) {
      setPhoneError(recipient.message ?? "Not a valid WhatsApp number.")
      return
    }
    const digitsOnly = recipient.digits
    if (!selectedTemplate || !context || !template) return
    if (problem) {
      toast.error(problem)
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
        components: buildDirectSendComponents(spec, inputs, headerMedia),
      })
      toast.success("Template sent")

      // No "create conversation" endpoint — the backend creates the conversation
      // row once the send lands, so poll the list briefly for it to show up.
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        // The template has already gone out. A failed poll must not fall into
        // the catch below, which would toast "Failed to send template" right
        // after "Template sent" and invite a second, double-billed send.
        const list = await refetchConversations().catch(() => null)
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
      const toError = getFieldError(err, "to")
      if (toError) setPhoneError(toError)
      else toast.error(getErrorMessage(err) || "Failed to send template")
    } finally {
      setIsSending(false)
    }
  }

  // Back to wherever they opened it from (inbox, the + button, the command
  // palette); a direct link with no history lands on the inbox instead.
  const handleClose = () => {
    if (window.history.length > 1) router.back()
    else router.push("/dashboard/chat")
  }

  return (
    <div className="container mx-auto p-6 h-full flex items-center justify-center">
      <Card className="relative w-full max-w-md">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          aria-label="Close"
          title="Close"
          // Leaving mid-send would let the poll below yank the user back into
          // the new chat from wherever they went.
          disabled={isSending}
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>
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
            <PhoneNumberInput
              id="new-chat-phone"
              value={phoneNumber}
              onChange={(digits) => {
                setPhoneNumber(digits)
                setPhoneError(null)
              }}
              error={phoneError}
            />
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            {!templatesLoading && context && templates.length === 0 ? (
              <NoApprovedTemplates
                templates={Array.isArray(allTemplates) ? allTemplates : []}
                returnTo="/dashboard/chat/new"
              />
            ) : (
              <Select
                value={selectedTemplate}
                onValueChange={(name) => {
                  setSelectedTemplate(name)
                  setInputs(fitTemplateInputs(templateSpec(templates.find((t) => t.name === name)), {}))
                  setHeaderMedia(undefined)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={templatesLoading || !context ? "Loading templates…" : "Select a template"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {template && <TemplateMessagePreview template={template} values={previewValues(spec, inputs)} />}
            {selectedTemplate && <ConversationChargeNote category={template?.category} />}
          </div>

          {template && spec.header.kind === "media" && (
            <TemplateHeaderMediaField
              format={spec.header.format}
              value={headerMedia}
              onChange={setHeaderMedia}
              accountId={context?.accountId}
              phoneNumberId={context?.phoneNumberId}
            />
          )}
          {template && (
            <div className="rounded-md border p-3">
              <TemplateInputsFields
                spec={spec}
                values={inputs}
                onChange={setInputs}
                // One known recipient: values are typed as they should arrive.
                allowTokens={false}
                idPrefix="new-chat-template"
              />
            </div>
          )}
        </CardContent>
        {/* Nothing to send with no approved template — the empty state above
            is the next step, so don't offer a button that can only sit disabled. */}
        {(templatesLoading || !context || templates.length > 0) && (
          <CardFooter className="flex justify-center">
            <Button
              onClick={handleStart}
              disabled={
                !phoneNumber.trim() ||
                !selectedTemplate ||
                isSending ||
                !!problem
              }
            >
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send & Start Chat
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
