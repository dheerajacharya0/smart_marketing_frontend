"use client"

import { useEffect, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { FileUp, Loader2, X } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { uploadWhatsappMedia, type WhatsappMediaType } from "@/services/api"
import {
  checkMediaFile,
  formatBytes,
  supportedMediaSummary,
  type MediaCategory,
} from "@/lib/media-upload"

export type AttachmentType = Exclude<WhatsappMediaType, "sticker">

const TYPE_LABELS: Record<AttachmentType, string> = {
  image: "Image",
  video: "Video",
  document: "Document",
  audio: "Audio",
}

const CAPTION_TYPES: MediaCategory[] = ["image", "video", "document"]

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Send media into a conversation, by upload or by link.
 *
 * Upload is the default because pasting a public URL is not something a shop
 * owner with a photo on their phone can do. The link tab stays for the case it
 * was built for — a file already hosted somewhere, sent without re-uploading.
 *
 * The upload path posts the bytes for a Cloud API media id and sends *that*, so
 * the file never needs to be publicly reachable. Which category the file is
 * comes from the file itself, not from the menu item that opened this dialog:
 * dropping a PDF onto the image action should send a document, not fail.
 */
export function AttachmentDialog({
  open,
  onOpenChange,
  type,
  accountId,
  phoneNumberId,
  initialFile,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: AttachmentType
  accountId: string | null | undefined
  phoneNumberId: string | null | undefined
  /** Pre-selected file, e.g. dropped onto the conversation. */
  initialFile?: File | null
  // Resolves on success; rejects with an Error whose message is shown inline.
  onSend: (details: {
    type: WhatsappMediaType
    link?: string
    mediaId?: string
    caption?: string
    filename?: string
  }) => Promise<void>
}) {
  const [tab, setTab] = useState<"upload" | "link">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [category, setCategory] = useState<MediaCategory | null>(null)
  const [dragging, setDragging] = useState(false)
  const [link, setLink] = useState("")
  const [caption, setCaption] = useState("")
  const [filename, setFilename] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectFile = (next: File | null) => {
    setError(null)
    setFileError(null)
    if (!next) {
      setFile(null)
      setCategory(null)
      return
    }
    const check = checkMediaFile(next)
    if (!check) {
      setFile(null)
      setCategory(null)
      setFileError(`WhatsApp can't send that file type. Supported: ${supportedMediaSummary()}.`)
      return
    }
    setFile(next)
    setCategory(check.category)
    setFileError(check.error)
    // Meta shows the document's filename to the recipient; default it to the
    // real one rather than making someone retype what they just picked.
    if (check.category === "document" && !filename) setFilename(next.name)
  }

  useEffect(() => {
    if (!open) return
    setTab(initialFile ? "upload" : "upload")
    setLink("")
    setCaption("")
    setFilename("")
    setError(null)
    setPreviewFailed(false)
    setDragging(false)
    setFile(null)
    setCategory(null)
    setFileError(null)
    if (initialFile) selectFile(initialFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, initialFile])

  // The file decides the category once one is picked; before that, the menu
  // item that opened the dialog does.
  const effectiveType: MediaCategory = category ?? type
  const showCaption = CAPTION_TYPES.includes(effectiveType)
  const showFilename = effectiveType === "document"
  const linkValid = isValidHttpUrl(link.trim())
  const canUpload = Boolean(file && !fileError && accountId && phoneNumberId)

  const extras = () => ({
    ...(showCaption && caption.trim() ? { caption: caption.trim() } : {}),
    ...(showFilename && filename.trim() ? { filename: filename.trim() } : {}),
  })

  const handleUploadAndSend = async () => {
    if (!file || !accountId || !phoneNumberId) return
    setError(null)
    setIsSending(true)
    try {
      const { id } = await uploadWhatsappMedia({
        accountId,
        phoneNumberId,
        type: effectiveType,
        file,
      })
      await onSend({ type: effectiveType, mediaId: id, ...extras() })
      onOpenChange(false)
    } catch (err) {
      // Covers both halves: a rejected upload (too big, wrong bytes) and a
      // rejected send. Both are worth reading, so neither is swallowed.
      setError(getErrorMessage(err) || "Failed to send media")
    } finally {
      setIsSending(false)
    }
  }

  const handleSendLink = async () => {
    setError(null)
    if (!linkValid) {
      setError("Enter a valid http(s) URL")
      return
    }
    setIsSending(true)
    try {
      await onSend({ type: effectiveType, link: link.trim(), ...extras() })
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
            Upload a file from this device, or send one that's already online.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "link")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload a file</TabsTrigger>
            <TabsTrigger value="link">Paste a link</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 pt-4">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                selectFile(e.dataTransfer.files?.[0] ?? null)
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
            >
              <FileUp className="mb-2 h-6 w-6 text-muted-foreground" />
              {file ? (
                <>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {effectiveType} · {formatBytes(file.size)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">Drop a file here, or click to choose one</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {supportedMediaSummary()}
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  selectFile(null)
                  if (inputRef.current) inputRef.current.value = ""
                }}
              >
                <X className="mr-2 h-3.5 w-3.5" /> Choose a different file
              </Button>
            )}

            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            {!accountId || !phoneNumberId ? (
              <p className="text-sm text-muted-foreground">
                Connect a WhatsApp number before uploading.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="link" className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="media-url">URL</Label>
              <Input
                id="media-url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value)
                  setPreviewFailed(false)
                }}
                placeholder={`https://cdn.example.com/${
                  type === "image"
                    ? "promo.jpg"
                    : type === "document"
                      ? "invoice.pdf"
                      : `file.${type === "video" ? "mp4" : "mp3"}`
                }`}
              />
              <p className="text-xs text-muted-foreground">
                Meta fetches this URL itself, so it has to be publicly reachable — a link behind a
                login won't send.
              </p>
            </div>

            {type === "image" && linkValid && (
              <div className="rounded-md border bg-muted/50 p-2">
                {previewFailed ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Couldn&apos;t preview this URL — it may still send if it&apos;s publicly
                    reachable.
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
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
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
              <p className="text-xs text-muted-foreground">What the recipient sees the file called.</p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          {tab === "upload" ? (
            <Button onClick={handleUploadAndSend} disabled={!canUpload || isSending}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSending ? "Uploading…" : "Send"}
            </Button>
          ) : (
            <Button onClick={handleSendLink} disabled={!linkValid || isSending}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
