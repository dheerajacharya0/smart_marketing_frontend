"use client"

import { ExternalLink, FileText, Image as ImageIcon, MessageCircle, PhoneCall, Video } from "lucide-react"
import type { WhatsappTemplate } from "@/services/api"
import {
  splitTemplateText,
  templateHeaderMediaFormat,
  type TemplateParamValues,
} from "@/lib/whatsapp-template"
import { cn } from "@/lib/utils"

const MEDIA_HEADER = {
  image: { icon: ImageIcon, label: "Image" },
  video: { icon: Video, label: "Video" },
  document: { icon: FileText, label: "Document" },
} as const

function FilledText({ text, values }: { text: string; values: Record<string, string> }) {
  return (
    <>
      {splitTemplateText(text, values).map((part, i) =>
        part.kind === "text" ? (
          <span key={i}>{part.text}</span>
        ) : part.value ? (
          <span key={i} className="font-medium">
            {part.value}
          </span>
        ) : (
          // An unfilled blank stays visible and marked, so it's obvious what
          // still has to be typed before this can go out.
          <span key={i} className="rounded bg-warning-soft px-1 font-mono text-[0.8em] text-warning">
            {`{{${part.token}}}`}
          </span>
        ),
      )}
    </>
  )
}

/**
 * The selected template as the contact will receive it: header, body, footer
 * and buttons, with the values typed so far filled in. Without this, picking a
 * template from the composer showed only its name and a row of {{n}} boxes —
 * no way to know what was about to be sent.
 */
export function TemplateMessagePreview({
  template,
  values,
  className,
}: {
  template: WhatsappTemplate
  values: TemplateParamValues
  className?: string
}) {
  const components = template.components ?? []
  const header = components.find((c) => c.type === "HEADER")
  const body = components.find((c) => c.type === "BODY")
  const footer = components.find((c) => c.type === "FOOTER")
  const buttons = components.find((c) => c.type === "BUTTONS")?.buttons ?? []
  const mediaFormat = templateHeaderMediaFormat(template)
  const media = mediaFormat ? MEDIA_HEADER[mediaFormat] : null

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-muted-foreground">Preview — what they&apos;ll receive</p>
      <div className="relative max-h-44 overflow-y-auto rounded-lg border border-border-subtle bg-muted/60 p-3">
        <div aria-hidden className="pointer-events-none absolute inset-0 doodle-wallpaper" />
        <div className="relative max-w-[85%] space-y-1">
          <div className="chat-bubble-in space-y-1 p-3 shadow-sm">
            {media && (
              <div className="flex h-20 items-center justify-center gap-2 rounded-md bg-muted text-xs text-muted-foreground">
                <media.icon className="h-4 w-4" /> {media.label} header
              </div>
            )}
            {header?.text && (
              <p className="whitespace-pre-wrap break-words text-sm font-bold">
                <FilledText text={header.text} values={values.header} />
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-sm">
              {body?.text ? (
                <FilledText text={body.text} values={values.body} />
              ) : (
                <span className="italic text-muted-foreground">(no body text)</span>
              )}
            </p>
            {footer?.text && (
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{footer.text}</p>
            )}
          </div>
          {buttons.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 rounded-lg bg-surface-2 py-2 text-sm text-info shadow-sm"
            >
              {b.type === "URL" ? (
                <ExternalLink className="h-3.5 w-3.5" />
              ) : b.type === "PHONE_NUMBER" ? (
                <PhoneCall className="h-3.5 w-3.5" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5" />
              )}
              <span className="truncate">{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
