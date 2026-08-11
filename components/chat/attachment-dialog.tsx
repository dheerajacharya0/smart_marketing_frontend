"use client"

import { useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { WhatsappMediaType } from "@/services/api"

export type AttachmentType = Exclude<WhatsappMediaType, "sticker">

const TYPE_LABELS: Record<AttachmentType, string> = {
  image: "Image",
  video: "Video",
  document: "Document",
  audio: "Audio",
}

const CAPTION_TYPES: AttachmentType[] = ["image", "video", "document"]

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function AttachmentDialog({
  open,
  onOpenChange,
  type,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: AttachmentType
  // Resolves on success; rejects with an Error whose message is shown inline.
  onSend: (details: { type: AttachmentType; link: string; caption?: string; filename?: string }) => Promise<void>
}) {
  const [link, setLink] = useState("")
  const [caption, setCaption] = useState("")
  const [filename, setFilename] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    setLink("")
    setCaption("")
    setFilename("")
    setError(null)
    setPreviewFailed(false)
  }, [open, type])

  const showCaption = CAPTION_TYPES.includes(type)
  const showFilename = type === "document"
  const linkValid = isValidHttpUrl(link.trim())

  const handleSend = async () => {
    setError(null)
    if (!linkValid) {
      setError("Enter a valid http(s) URL")
      return
    }
    setIsSending(true)
    try {
      await onSend({
        type,
        link: link.trim(),
        ...(showCaption && caption.trim() ? { caption: caption.trim() } : {}),
        ...(showFilename && filename.trim() ? { filename: filename.trim() } : {}),
      })
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to send media")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send {TYPE_LABELS[type]}</DialogTitle>
          <DialogDescription>
            Paste a public URL — file uploads aren't supported yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="media-url">URL</Label>
            <Input
              id="media-url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setPreviewFailed(false)
              }}
              placeholder={`https://cdn.example.com/${type === "image" ? "promo.jpg" : type === "document" ? "invoice.pdf" : `file.${type === "video" ? "mp4" : "mp3"}`}`}
            />
          </div>

          {type === "image" && linkValid && (
            <div className="rounded-md border bg-muted/50 p-2">
              {previewFailed ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Couldn't preview this URL — it may still send if it's publicly reachable.
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.trim()}
                  alt="preview"
                  className="mx-auto max-h-48 rounded object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              )}
            </div>
          )}

          {showCaption && (
            <div className="grid gap-2">
              <Label htmlFor="media-caption">Caption (optional)</Label>
              <Textarea
                id="media-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {showFilename && (
            <div className="grid gap-2">
              <Label htmlFor="media-filename">Filename (optional)</Label>
              <Input
                id="media-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="invoice.pdf"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!linkValid || isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
