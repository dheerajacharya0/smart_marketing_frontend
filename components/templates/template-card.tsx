"use client"

import Link from "next/link"
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  PhoneCall,
  Send,
  Trash2,
  Video,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { extractTokens, isPositional, type TemplateComponent } from "@/lib/whatsapp-template"
import type { WhatsappTemplate } from "@/services/api"
import { cn } from "@/lib/utils"

export const TEMPLATE_STATUS_CLASS: Record<string, string> = {
  APPROVED: "bg-success-soft text-success border-success/25",
  PENDING: "bg-warning-soft text-warning border-warning/25",
  IN_APPEAL: "bg-warning-soft text-warning border-warning/25",
  REJECTED: "bg-destructive-soft text-destructive border-destructive/25",
  PAUSED: "bg-info-soft text-info border-info/25",
  DISABLED: "bg-muted text-muted-foreground border-border",
}

/** The body with its example values in place of {{1}} / {{name}}, as Meta will review it. */
function bodyWithExamples(body: TemplateComponent | undefined): string {
  const text = body?.text ?? ""
  const tokens = extractTokens(text)
  const examples: Record<string, string> = {}
  if (isPositional(tokens)) {
    const values = body?.example?.body_text?.[0] ?? []
    ;[...tokens].sort((a, b) => Number(a) - Number(b)).forEach((t, i) => (examples[t] = values[i] ?? ""))
  } else {
    for (const p of body?.example?.body_text_named_params ?? []) examples[p.param_name] = p.example
  }
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, token) => examples[token] || match)
}

const MEDIA_ICON = { IMAGE: ImageIcon, VIDEO: Video, DOCUMENT: FileText } as const

/**
 * One template as it will arrive: a WhatsApp bubble with its header, body
 * (examples filled in), footer and buttons, over the chat texture — and its
 * name, review status, category and language underneath. A row in a table
 * showed the name of a message; this shows the message.
 */
export function TemplateCard({
  template,
  editable,
  deleting,
  onEdit,
  onDelete,
  index = 0,
}: {
  template: WhatsappTemplate
  editable: boolean
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
  index?: number
}) {
  const components = template.components ?? []
  const header = components.find((c) => c.type === "HEADER")
  const body = components.find((c) => c.type === "BODY")
  const footer = components.find((c) => c.type === "FOOTER")
  const buttons = components.find((c) => c.type === "BUTTONS")?.buttons ?? []
  const MediaIcon = header?.format ? MEDIA_ICON[header.format as keyof typeof MEDIA_ICON] : undefined
  const status = template.status ?? ""
  const rejection = typeof template.rejected_reason === "string" && template.rejected_reason !== "NONE"
    ? template.rejected_reason
    : null

  return (
    <article
      style={{ "--signal-index": Math.min(index, 7) } as React.CSSProperties}
      className="signal-rise flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-card shadow-xs transition-shadow duration-base ease-out-soft hover:shadow-md"
    >
      {/* The message, on WhatsApp's chat ground expressed through the theme. */}
      <div className="relative flex-1 bg-muted/50 p-4 dark:bg-background/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 doodle-wallpaper" />
        <div className="relative max-w-[92%] space-y-1 rounded-lg rounded-tl-none bg-surface-2 p-3 shadow-sm dark:bg-muted">
          {MediaIcon ? (
            <div className="mb-1 flex h-24 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-background/60">
              <MediaIcon className="h-6 w-6" />
            </div>
          ) : header?.text ? (
            <p className="text-sm font-semibold">{header.text.replace(/\{\{\s*1\s*\}\}/, header.example?.header_text?.[0] || "{{1}}")}</p>
          ) : null}
          <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm">
            {bodyWithExamples(body) || <span className="italic text-muted-foreground">No body text</span>}
          </p>
          {footer?.text && <p className="text-xs text-muted-foreground">{footer.text}</p>}
        </div>
        {buttons.length > 0 && (
          <div className="relative mt-1 max-w-[92%] space-y-1">
            {buttons.slice(0, 3).map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-surface-2 py-1.5 text-xs font-medium text-info shadow-sm dark:bg-muted"
              >
                {b.type === "URL" ? (
                  <ExternalLink className="h-3 w-3" />
                ) : b.type === "PHONE_NUMBER" ? (
                  <PhoneCall className="h-3 w-3" />
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                <span className="truncate">{b.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border-subtle p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-mono text-sm font-medium" title={template.name}>
            {template.name}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 shrink-0"
                aria-label={`Actions for ${template.name}`}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status === "APPROVED" && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/campaigns?new=1">
                    <Send className="mr-2 h-4 w-4" />
                    Use in a campaign
                  </Link>
                </DropdownMenuItem>
              )}
              {editable && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {(status === "APPROVED" || editable) && <DropdownMenuSeparator />}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {status && (
            <Badge variant="outline" className={cn("text-[0.6875rem]", TEMPLATE_STATUS_CLASS[status])}>
              {status.toLowerCase().replace(/_/g, " ")}
            </Badge>
          )}
          {template.category && (
            <Badge variant="outline" className="text-[0.6875rem] lowercase">
              {template.category}
            </Badge>
          )}
          {template.language && (
            <span className="font-mono text-[0.6875rem] text-muted-foreground">{template.language}</span>
          )}
        </div>
        {rejection && (
          <p className="text-xs text-destructive">
            Rejected: {rejection.toLowerCase().replace(/_/g, " ")}
          </p>
        )}
      </div>
    </article>
  )
}
