"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  Video,
  FileText,
  Loader2,
  LayoutGrid,
  Image as ImageIcon,
  Film,
  Music,
  List,
  MousePointerClick,
  Clock,
  FileUp,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  sendWhatsappMessage,
  sendWhatsappTemplate,
  sendWhatsappMedia,
  sendWhatsappInteractive,
  listWhatsappTemplates,
  isOutside24hWindow,
  type WhatsappTemplate,
  type WhatsappMediaType,
  type InteractiveInput,
} from "@/services/api"
import { checkMediaFile, supportedMediaSummary } from "@/lib/media-upload"
import { useQueryClient } from "@tanstack/react-query"
import { useSessionWindow, queryKeys } from "@/hooks/use-queries"
import { AttachmentDialog, type AttachmentType } from "@/components/chat/attachment-dialog"
import { InteractiveDialog, type InteractiveKind } from "@/components/chat/interactive-dialog"
import { MediaBubble } from "@/components/chat/media-bubble"
import { InteractiveBubble } from "@/components/chat/interactive-bubble"
import { ConversationMeta } from "@/components/chat/conversation-meta"
import { NotesPanel } from "@/components/chat/notes-panel"
import { Explain } from "@/components/explain"
import { toast } from "react-hot-toast"
import { handleFacebookError } from "@/services/facebook-error-handler"
import { useWhatsappConversations } from "@/hooks/use-whatsapp-conversations"
import { useChatMessages, type ConversationMessage } from "@/hooks/use-chat-messages"
import { useFlowHandoffs } from "@/hooks/use-flow-handoffs"
import { Badge } from "@/components/ui/badge"
import { X, Bot, StickyNote } from "lucide-react"
import {
  getTemplateParamGroups,
  buildSendTemplateComponents,
  allTemplateParamsFilled,
  emptyTemplateParamValues,
  type TemplateParamValues,
} from "@/lib/whatsapp-template"

export default function ChatDetailPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = React.use(params)
  const [message, setMessage] = useState("")
  const [pendingMessages, setPendingMessages] = useState<ConversationMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { context, conversations, loading: conversationsLoading } = useWhatsappConversations()
  const conversation = conversations.find((c) => c.id === chatId)
  const [showNotes, setShowNotes] = useState(false)

  // Known labels across the account feed the label autocomplete.
  const knownLabels = useMemo(() => {
    const set = new Set<string>()
    conversations.forEach((c) => c.labels.forEach((l) => set.add(l)))
    return [...set].sort()
  }, [conversations])
  const {
    messages: threadMessages,
    loading: messagesLoading,
    loadingOlder,
    hasMore,
    loadOlder,
    refetch,
  } = useChatMessages(chatId, context?.accountId ?? null)
  const loading = conversationsLoading || messagesLoading
  const messages = [...threadMessages, ...pendingMessages]

  const { handoffFor, dismiss: dismissHandoff } = useFlowHandoffs(context?.accountId ?? null)
  const handoff = handoffFor(chatId)

  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [templateParamValues, setTemplateParamValues] = useState<TemplateParamValues>(emptyTemplateParamValues())
  const [isSendingTemplate, setIsSendingTemplate] = useState(false)

  const selectedTemplateObj = templates.find((t) => t.name === selectedTemplate)
  const templateParamGroups = selectedTemplateObj ? getTemplateParamGroups(selectedTemplateObj) : []

  const [attachmentType, setAttachmentType] = useState<AttachmentType | null>(null)
  // A file dropped onto the thread. Opens the attachment dialog pre-filled
  // rather than sending straight away — a caption or the wrong file dropped by
  // accident both need a confirmation step.
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [interactiveKind, setInteractiveKind] = useState<InteractiveKind | null>(null)

  // 24-hour service window for this recipient. Free-form sends are only legal
  // while it's open; outside it, an approved template is the only way through.
  const queryClient = useQueryClient()
  const { data: sessionWindow } = useSessionWindow(
    context?.accountId,
    context?.phoneNumberId,
    conversation?.contactWaId
  )
  // Only gate on a definite `false` — while the check is in flight we don't
  // disable a composer that may well be legal.
  const windowClosed = sessionWindow?.open === false

  // Re-render once a minute so the countdown below actually counts down; the
  // window closes on a wall clock, not on any event we receive.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!sessionWindow?.open || !sessionWindow.expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [sessionWindow?.open, sessionWindow?.expiresAt])

  /** "3h 12m" / "18m" left, or null once it has run out. */
  const windowRemaining = (() => {
    if (!sessionWindow?.open || !sessionWindow.expiresAt) return null
    const ms = new Date(sessionWindow.expiresAt).getTime() - now
    if (!Number.isFinite(ms) || ms <= 0) return null
    const mins = Math.floor(ms / 60_000)
    const hours = Math.floor(mins / 60)
    return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`
  })()

  /** Re-read the window after a send that the backend rejected as out-of-window. */
  const invalidateSessionWindow = () => {
    if (!context || !conversation) return
    queryClient.invalidateQueries({
      queryKey: queryKeys.sessionWindow(
        context.accountId,
        context.phoneNumberId,
        conversation.contactWaId
      ),
    })
  }

  // Dialog onSend handlers throw on failure so the dialog shows the API
  // message inline (400s are validation errors worth reading).
  const handleSendMedia = async (details: {
    type: WhatsappMediaType
    link?: string
    mediaId?: string
    caption?: string
    filename?: string
  }) => {
    if (!context || !conversation) throw new Error("No conversation selected")
    await sendWhatsappMedia({
      accountId: context.accountId,
      phoneNumberId: context.phoneNumberId,
      to: conversation.contactWaId,
      ...details,
    })
    toast.success("Media sent")
    refetch()
  }

  const handleSendInteractive = async (input: InteractiveInput) => {
    if (!context || !conversation) throw new Error("No conversation selected")
    await sendWhatsappInteractive({
      accountId: context.accountId,
      phoneNumberId: context.phoneNumberId,
      to: conversation.contactWaId,
      ...input,
    })
    toast.success("Message sent")
    refetch()
  }

  useEffect(() => {
    if (!context) return
    listWhatsappTemplates(context.accountId, context.wabaId)
      .then((response) => {
        setTemplates(Array.isArray(response) ? response : [])
      })
      .catch((err) => console.error("Failed to load templates:", err))
  }, [context])

  // Outbound template events only carry the template name + raw parameters,
  // not the resolved text — look up the fetched template definition and
  // substitute {{n}} placeholders with the values actually sent.
  const renderMessageContent = (msg: ConversationMessage) => {
    if (!msg.templateName) return msg.content
    const template = templates.find(
      (t) => t.name === msg.templateName && (!msg.templateLanguage || t.language === msg.templateLanguage)
    )
    const bodyComponent = (template?.components || []).find((c) => c.type === "BODY")
    if (!bodyComponent?.text) return msg.content
    if (!msg.templateParams?.length) return bodyComponent.text
    const tokens = [...bodyComponent.text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)]
      .map((m) => m[1])
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .sort((a, b) => Number(a) - Number(b))
    return bodyComponent.text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match: string, tok: string) => {
      const index = tokens.indexOf(tok)
      return index >= 0 && msg.templateParams?.[index] !== undefined ? msg.templateParams[index] : match
    })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Drop an optimistic bubble once the real outbound row for it lands (webhook
  // -> refetch). Without this the thread shows the message twice, once stuck on
  // "accepted" forever.
  useEffect(() => {
    if (pendingMessages.length === 0) return
    const known = new Set(
      threadMessages.map((m) => m.waMessageId).filter((id): id is string => Boolean(id))
    )
    if (known.size === 0) return
    setPendingMessages((prev) =>
      prev.filter((m) => !(m.waMessageId && known.has(m.waMessageId)))
    )
  }, [threadMessages, pendingMessages.length])

  const handleSendMessage = async () => {
    if (!message.trim() || !context || !conversation) return
    const content = message
    const pendingId = `pending-${Date.now()}`
    setMessage("")
    setIsSending(true)
    setPendingMessages((prev) => [
      ...prev,
      { id: pendingId, content, sender: "me", timestamp: new Date() },
    ])

    try {
      const result = await sendWhatsappMessage({
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        to: conversation.contactWaId,
        message: content,
      })
      // `accepted` means Meta queued it — NOT delivered. Carry that status onto
      // the bubble and hold it until the delivery webhook replaces this row with
      // the real one (matched on waMessageId).
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, status: result.deliveryStatus ?? "accepted", waMessageId: result.messageId ?? null }
            : m
        )
      )
      refetch()
    } catch (err) {
      setPendingMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, status: "failed" } : m))
      )
      if (isOutside24hWindow(err)) {
        // Branch on the code, never the message text. The window state we had
        // was stale, so re-read it — that flips the composer to the template UI.
        invalidateSessionWindow()
        toast.error(
          "This contact's 24-hour window has closed. Send an approved template instead."
        )
      } else if (!handleFacebookError(err)) {
        toast.error(getErrorMessage(err) || "Failed to send message")
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !context || !conversation || !selectedTemplateObj) return
    if (!allTemplateParamsFilled(templateParamGroups, templateParamValues)) {
      toast.error("Fill in all template variables before sending")
      return
    }

    setIsSendingTemplate(true)
    try {
      await sendWhatsappTemplate({
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        to: conversation.contactWaId,
        templateName: selectedTemplateObj.name,
        languageCode: selectedTemplateObj.language ?? "en_US",
        components: buildSendTemplateComponents(templateParamGroups, templateParamValues),
      })
      toast.success("Template sent")
      setSelectedTemplate("")
      setTemplateParamValues(emptyTemplateParamValues())
      refetch()
    } catch (err) {
      if (!handleFacebookError(err)) {
        toast.error(getErrorMessage(err) || "Failed to send template")
      }
    } finally {
      setIsSendingTemplate(false)
    }
  }

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  /**
   * `accepted` means Meta queued it — NOT delivered. It renders as plain "Sent"
   * (one tick), and only a webhook status event upgrades it to delivered/read.
   * A message can still end up `failed` long after being accepted.
   */
  const statusLabel = (status: string): { text: string; title: string } =>
    status === "accepted"
      ? { text: "Sent", title: "Queued by WhatsApp — not delivered yet" }
      : { text: status, title: `Message ${status}` }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading conversation...
      </div>
    )
  }

  if (!context) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No WhatsApp Business account connected yet.
      </div>
    )
  }

  // Drop a file anywhere on the thread to attach it. `dragenter/leave` fire on
  // every child element, so the overlay is driven by whether the pointer is
  // still inside the container rather than by a counter that gets out of step.
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const check = checkMediaFile(file)
    if (!check) {
      toast.error(`WhatsApp can't send that file type. Supported: ${supportedMediaSummary()}.`)
      return
    }
    setDroppedFile(file)
    // The dialog re-derives the category from the file; a sticker has no menu
    // entry, so open it under "image" and let it correct itself.
    setAttachmentType(check.category === "sticker" ? "image" : check.category)
  }

  return (
    <div className="flex h-screen">
      <div
        className="relative flex flex-col flex-1 min-w-0 h-full"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          setIsDraggingFile(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDraggingFile(false)
        }}
        onDrop={handleFileDrop}
      >
        {isDraggingFile && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-primary bg-background/80">
            <div className="text-center">
              <FileUp className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-medium">Drop to attach</p>
              <p className="text-xs text-muted-foreground">{supportedMediaSummary()}</p>
            </div>
          </div>
        )}
      {/* Chat header */}
      <div className="p-4 border-b bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="border-2 border-whatsapp/20">
              <AvatarFallback className="bg-whatsapp/10 text-whatsapp">
                {(conversation?.name || "?").slice(-2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-medium">{conversation?.name || "Unknown contact"}</h2>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={showNotes ? "secondary" : "ghost"}
              size="icon"
              title="Internal notes"
              onClick={() => setShowNotes((v) => !v)}
            >
              <StickyNote className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-facebook hover:bg-facebook/10 hover:text-facebook">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-facebook hover:bg-facebook/10 hover:text-facebook">
              <Video className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {conversation && (
          <ConversationMeta
            conversationId={chatId}
            accountId={context.accountId}
            assigneeId={conversation.assigneeId}
            assigneeName={conversation.assigneeName}
            labels={conversation.labels}
            knownLabels={knownLabels}
          />
        )}
      </div>

      {/* Flow handoff banner */}
      {handoff && (
        <div className="flex items-start gap-3 border-b bg-warning-soft p-3 text-warning">
          <Bot className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              Handed off from bot "{handoff.flowName}" — needs a human. Assign it to an agent above.
            </p>
            {Object.keys(handoff.variables).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(handoff.variables).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => dismissHandoff(chatId)}
            aria-label="Dismiss handoff banner"
            className="shrink-0 hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
        <div className="space-y-4">
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load older messages
              </Button>
            </div>
          )}
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No messages yet. Send a template to start the conversation (required outside the 24h window).
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
              {msg.sender !== "me" && (
                <Avatar className="h-8 w-8 mr-2 mt-1">
                  <AvatarFallback>{(conversation?.name || "?").slice(-2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`max-w-[70%] p-3 ${
                  msg.sender === "me" ? "chat-bubble-out" : "chat-bubble-in"
                }`}
              >
                {msg.media ? (
                  <MediaBubble media={msg.media} accountId={context.accountId} />
                ) : msg.interactive ? (
                  <InteractiveBubble interactive={msg.interactive} />
                ) : (
                  <>
                    {msg.isMenuReply && (
                      <p className={`text-xs mb-0.5 flex items-center gap-1 ${msg.sender === "me" ? "text-white/70" : "text-muted-foreground"}`}>
                        <MousePointerClick className="h-3 w-3" /> replied to menu
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{renderMessageContent(msg)}</p>
                  </>
                )}
                <div className={`text-xs mt-1 text-right flex items-center justify-end gap-1 ${msg.sender === "me" ? "text-white/80" : "text-muted-foreground"}`}>
                  {formatTime(msg.timestamp)}
                  {msg.sender === "me" && msg.status === "failed" ? (
                    <span
                      className="text-destructive/80 font-medium cursor-help"
                      title={
                        msg.errorTitle || msg.errorCode
                          ? `Failed${msg.errorCode ? ` (${msg.errorCode})` : ""}: ${msg.errorTitle ?? "Delivery failed"}`
                          : "Delivery failed"
                      }
                    >
                      · Failed{msg.errorCode ? ` (${msg.errorCode})` : ""}
                    </span>
                  ) : (
                    msg.sender === "me" &&
                    msg.status && (
                      <span className="capitalize" title={statusLabel(msg.status).title}>
                        · {statusLabel(msg.status).text}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message input */}
      <div className="p-4 border-t bg-card space-y-2">
        {windowClosed && (
          <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-soft p-3 text-warning">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              <span className="font-medium">
                The <Explain term="service-window">24-hour reply window</Explain> has closed.
              </span>{" "}
              {sessionWindow?.lastInboundAt
                ? `${conversation?.name || "This contact"} last messaged you on ${new Date(
                    sessionWindow.lastInboundAt
                  ).toLocaleString()}. `
                : ""}
              WhatsApp only allows an approved template until they reply again.
            </p>
          </div>
        )}
        {windowRemaining && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Free replies open for {windowRemaining} — after that, templates only.
          </p>
        )}
        {templates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Select
                value={selectedTemplate}
                onValueChange={(name) => {
                  setSelectedTemplate(name)
                  setTemplateParamValues(emptyTemplateParamValues())
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Send a template (for outside the 24h window)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSendTemplate}
                disabled={
                  !selectedTemplate ||
                  isSendingTemplate ||
                  !allTemplateParamsFilled(templateParamGroups, templateParamValues)
                }
              >
                <FileText className="h-5 w-5" />
              </Button>
            </div>
            {templateParamGroups.map((group) => (
              <div key={group.type} className="flex flex-wrap gap-2">
                {group.tokens.map((tok, i) => (
                  <Input
                    key={tok}
                    className="flex-1 min-w-32"
                    value={templateParamValues[group.type]?.[tok] || ""}
                    onChange={(e) =>
                      setTemplateParamValues({
                        ...templateParamValues,
                        [group.type]: { ...templateParamValues[group.type], [tok]: e.target.value },
                      })
                    }
                    placeholder={
                      group.examples[i]
                        ? `${group.type} {{${tok}}} e.g. ${group.examples[i]}`
                        : `${group.type} {{${tok}}}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Media and interactive messages are free-form too — same window rule. */}
              <Button variant="ghost" size="icon" title="Attach media" disabled={windowClosed}>
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setAttachmentType("image")}>
                <ImageIcon className="mr-2 h-4 w-4" /> Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAttachmentType("video")}>
                <Film className="mr-2 h-4 w-4" /> Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAttachmentType("document")}>
                <FileText className="mr-2 h-4 w-4" /> Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAttachmentType("audio")}>
                <Music className="mr-2 h-4 w-4" /> Audio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Interactive message" disabled={windowClosed}>
                <LayoutGrid className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setInteractiveKind("buttons")}>
                <MousePointerClick className="mr-2 h-4 w-4" /> Reply buttons
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInteractiveKind("list")}>
                <List className="mr-2 h-4 w-4" /> List message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Input
            placeholder={
              windowClosed ? "Free-form replies are closed — send a template above" : "Type a message"
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={windowClosed}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isSending || windowClosed}
            size="icon"
            className="bg-whatsapp hover:bg-whatsapp-dark"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {attachmentType && (
        <AttachmentDialog
          open={!!attachmentType}
          onOpenChange={(open) => {
            if (!open) {
              setAttachmentType(null)
              setDroppedFile(null)
            }
          }}
          type={attachmentType}
          accountId={context.accountId}
          phoneNumberId={context.phoneNumberId}
          initialFile={droppedFile}
          onSend={handleSendMedia}
        />
      )}
      {interactiveKind && (
        <InteractiveDialog
          open={!!interactiveKind}
          onOpenChange={(open) => !open && setInteractiveKind(null)}
          kind={interactiveKind}
          onSend={handleSendInteractive}
        />
      )}
      </div>

      {showNotes && conversation && (
        <NotesPanel conversationId={chatId} accountId={context.accountId} onClose={() => setShowNotes(false)} />
      )}
    </div>
  )
}
