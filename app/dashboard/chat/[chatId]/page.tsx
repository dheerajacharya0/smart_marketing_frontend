"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import Link from "next/link"
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
  MessagesSquare,
  ArrowLeft,
  PlugZap,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ApiError,
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
import { MessageBubble, DaySeparator, groupMessages } from "@/components/chat/message-bubble"
import { EmojiPicker } from "@/components/chat/emoji-picker"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ConversationMeta } from "@/components/chat/conversation-meta"
import { NotesPanel } from "@/components/chat/notes-panel"
import { Explain } from "@/components/explain"
import { ConversationChargeNote } from "@/components/cost-estimate"
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
  const messageInputRef = useRef<HTMLInputElement>(null)

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
  // Memoised: this feeds the grouping memo below, and a fresh array every
  // render would re-group the whole thread on every keystroke in the composer.
  const messages = useMemo(
    () => [...threadMessages, ...pendingMessages],
    [threadMessages, pendingMessages],
  )

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
      // Carry the reason onto the bubble, not only into the toast — the toast
      // is gone in four seconds and the failed message is still sitting there.
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                status: "failed",
                errorCode: err instanceof ApiError ? (err.metaCode ?? null) : null,
                errorDetails: getErrorMessage(err) || null,
              }
            : m
        )
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

  // Day sections, each split into runs by sender — see components/chat/message-bubble.tsx.
  const messageGroups = useMemo(() => groupMessages(messages), [messages])

  /**
   * Insert at the caret rather than appending: someone who clicked back into
   * the middle of a sentence to add an emoji means it to go there.
   */
  const insertEmoji = (emoji: string) => {
    const input = messageInputRef.current
    if (!input) {
      setMessage((prev) => prev + emoji)
      return
    }
    const start = input.selectionStart ?? message.length
    const end = input.selectionEnd ?? message.length
    const next = message.slice(0, start) + emoji + message.slice(end)
    setMessage(next)
    // The value lands on the next render, so move the caret after it.
    requestAnimationFrame(() => {
      input.focus()
      const caret = start + emoji.length
      input.setSelectionRange(caret, caret)
    })
  }


  if (loading) {
    // Skeleton of the thread rather than a spinner: the shape of what is
    // coming is already known, so show it.
    return (
      <div className="flex h-full flex-col">
        <div className="space-y-3 border-b border-border-subtle bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="chat-thread flex-1 space-y-3 p-4">
          {[68, 44, 76, 52, 60].map((width, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}
            >
              <Skeleton className="h-10 rounded-bubble" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!context) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={PlugZap}
          title="No WhatsApp account connected"
          description="Finish the WhatsApp setup flow and your conversations appear here in real time."
          action={
            <Button asChild>
              <Link href="/dashboard/whatsapp">Go to WhatsApp setup</Link>
            </Button>
          }
        />
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
    <div className="relative flex h-full min-h-0">
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
          <div className="flex min-w-0 items-center gap-3">
            {/* Back to the list — the list pane is hidden at this width. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Back to conversations"
              asChild
            >
              <Link href="/dashboard/chat">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Avatar className="h-10 w-10 shrink-0 border border-whatsapp/20">
              <AvatarFallback className="bg-whatsapp/10 text-whatsapp">
                {(conversation?.name || "?").slice(-2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate font-display font-semibold">
                {conversation?.name || "Unknown contact"}
              </h2>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {conversation?.contactWaId ? `+${conversation.contactWaId}` : "WhatsApp"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant={showNotes ? "secondary" : "ghost"}
              size="icon"
              title="Internal notes — only your team sees these"
              onClick={() => setShowNotes((v) => !v)}
            >
              <StickyNote className="h-5 w-5" />
            </Button>
            {/* Calling is not something the WhatsApp Business API can do, so
                there are no call buttons here to imply otherwise. No actions
                menu either: internal notes was its only entry, and it sat
                next to the notes button that does the same thing. No "view
                contact" either — a conversation row carries the WhatsApp ID,
                not the contact record id, so the link would have nowhere
                real to go. */}
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
      <div className="chat-thread flex-1 overflow-y-auto px-3 py-2 sm:px-4">
        {hasMore && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load older messages
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyState
            doodle
            icon={MessagesSquare}
            title="No messages yet"
            description={
              windowClosed
                ? "This contact hasn\u2019t written recently, so start with an approved template below."
                : "Say hello \u2014 anything you send lands on their phone as a WhatsApp message."
            }
            hint="Outside the 24-hour reply window only approved templates can start a conversation."
          />
        ) : (
          messageGroups.map((group) => (
            <div key={group.date.toDateString()} className="relative">
              <DaySeparator date={group.date} />
              {group.runs.map((run) =>
                run.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    contactName={conversation?.name || "?"}
                    accountId={context.accountId}
                    isFirstOfGroup={i === 0}
                    isLastOfGroup={i === run.length - 1}
                    renderContent={renderMessageContent}
                  />
                )),
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-2" />
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
            {/* Deliberately not softened when the service window is open: that
                window is free for free-form replies, not for templates. */}
            {selectedTemplate && (
              <ConversationChargeNote category={selectedTemplateObj?.category} />
            )}
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
        <div className="flex items-center gap-1 sm:gap-2">
          <EmojiPicker onSelect={insertEmoji} disabled={windowClosed} />
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
            ref={messageInputRef}
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
            className="shrink-0 bg-whatsapp text-white hover:bg-whatsapp-dark"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
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
