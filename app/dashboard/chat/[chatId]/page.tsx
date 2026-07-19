"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
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
  type InteractiveInput,
} from "@/services/api"
import { AttachmentDialog, type AttachmentType } from "@/components/chat/attachment-dialog"
import { InteractiveDialog, type InteractiveKind } from "@/components/chat/interactive-dialog"
import { MediaBubble } from "@/components/chat/media-bubble"
import { InteractiveBubble } from "@/components/chat/interactive-bubble"
import { ConversationMeta } from "@/components/chat/conversation-meta"
import { NotesPanel } from "@/components/chat/notes-panel"
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

  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [templateParamValues, setTemplateParamValues] = useState<TemplateParamValues>(emptyTemplateParamValues())
  const [isSendingTemplate, setIsSendingTemplate] = useState(false)

  const selectedTemplateObj = templates.find((t) => t.name === selectedTemplate)
  const templateParamGroups = selectedTemplateObj ? getTemplateParamGroups(selectedTemplateObj) : []

  const [attachmentType, setAttachmentType] = useState<AttachmentType | null>(null)
  const [interactiveKind, setInteractiveKind] = useState<InteractiveKind | null>(null)

  // Dialog onSend handlers throw on failure so the dialog shows the API
  // message inline (400s are validation errors worth reading).
  const handleSendMedia = async (details: {
    type: AttachmentType
    link: string
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
      .then((response: any) => {
        const list = Array.isArray(response) ? response : response?.data
        setTemplates(Array.isArray(list) ? list : [])
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
    const bodyComponent = (template?.components || []).find((c: any) => c.type === "BODY")
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

  const handleSendMessage = async () => {
    if (!message.trim() || !context || !conversation) return
    const content = message
    setMessage("")
    setIsSending(true)
    setPendingMessages((prev) => [
      ...prev,
      { id: `pending-${Date.now()}`, content, sender: "me", timestamp: new Date() },
    ])

    try {
      await sendWhatsappMessage({
        accountId: context.accountId,
        phoneNumberId: context.phoneNumberId,
        to: conversation.contactWaId,
        message: content,
      })
      refetch()
    } catch (err: any) {
      if (!handleFacebookError(err)) {
        toast.error(err.message || "Failed to send message (24h window may have expired — try a template)")
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
        languageCode: selectedTemplateObj.language,
        components: buildSendTemplateComponents(templateParamGroups, templateParamValues),
      })
      toast.success("Template sent")
      setSelectedTemplate("")
      setTemplateParamValues(emptyTemplateParamValues())
      refetch()
    } catch (err: any) {
      if (!handleFacebookError(err)) {
        toast.error(err.message || "Failed to send template")
      }
    } finally {
      setIsSendingTemplate(false)
    }
  }

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

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

  return (
    <div className="flex h-screen">
      <div className="flex flex-col flex-1 min-w-0 h-full">
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
        <div className="flex items-start gap-3 border-b bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
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
                      className="text-red-200 dark:text-red-300 font-medium cursor-help"
                      title={
                        msg.errorTitle || msg.errorCode
                          ? `Failed${msg.errorCode ? ` (${msg.errorCode})` : ""}: ${msg.errorTitle ?? "Delivery failed"}`
                          : "Delivery failed"
                      }
                    >
                      · Failed{msg.errorCode ? ` (${msg.errorCode})` : ""}
                    </span>
                  ) : (
                    msg.sender === "me" && msg.status && <span className="capitalize">· {msg.status}</span>
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
                  {templates.map((t: any) => (
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
              <Button variant="ghost" size="icon" title="Attach media">
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
              <Button variant="ghost" size="icon" title="Interactive message">
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
            placeholder="Type a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
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
            disabled={!message.trim() || isSending}
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
          onOpenChange={(open) => !open && setAttachmentType(null)}
          type={attachmentType}
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
