"use client"

import { useRef, useState } from "react"
import { FileUp, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getErrorMessage } from "@/lib/errors"
import { checkMediaFile, formatBytes } from "@/lib/media-upload"
import { uploadWhatsappMedia, type TemplateHeaderMedia } from "@/services/api"

/**
 * The file (or URL) that fills a template's media header.
 *
 * A template approved with an IMAGE/VIDEO/DOCUMENT header cannot send without
 * one — Meta rejects the whole message — so this field is required whenever the
 * chosen template has such a header, and saying so up front beats a campaign
 * that fails on every recipient for the same reason.
 *
 * Upload and link are both first-class because they answer different needs: a
 * shop owner has a file on their laptop, an integration already has a CDN URL.
 * The link form also accepts `{{name}}` / `{{attributes.key}}` tokens, which is
 * the only way to make the header differ per recipient — a campaign freezes
 * them at creation, a drip resolves them at send time.
 */
export function TemplateHeaderMediaField({
  format,
  value,
  onChange,
  accountId,
  phoneNumberId,
  allowTokens = false,
}: {
  /** From `templateHeaderMediaFormat(template)`. */
  format: "image" | "video" | "document"
  value: TemplateHeaderMedia | undefined
  onChange: (value: TemplateHeaderMedia | undefined) => void
  accountId: string | null | undefined
  phoneNumberId: string | null | undefined
  /** Show the personalisation hint — only true where tokens are resolved. */
  allowTokens?: boolean
}) {
  const [tab, setTab] = useState<"upload" | "link">(value?.link ? "link" : "upload")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedName, setUploadedName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | null) => {
    setError(null)
    if (!file) return
    if (!accountId || !phoneNumberId) {
      setError("Connect a WhatsApp number before uploading.")
      return
    }
    const check = checkMediaFile(file)
    if (!check) {
      setError("WhatsApp can't use that file type in a header.")
      return
    }
    if (check.category !== format) {
      // The header format is fixed by the approved template; a different file
      // type here fails at Meta with an error that names neither.
      setError(`This template needs ${format === "image" ? "an" : "a"} ${format}, not a ${check.category}.`)
      return
    }
    if (check.error) {
      setError(check.error)
      return
    }
    setUploading(true)
    try {
      const { id } = await uploadWhatsappMedia({ accountId, phoneNumberId, type: format, file })
      setUploadedName(file.name)
      onChange({
        type: format,
        mediaId: id,
        ...(format === "document" ? { filename: file.name } : {}),
      })
    } catch (err) {
      setError(getErrorMessage(err) || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const clear = () => {
    setUploadedName(null)
    setError(null)
    onChange(undefined)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="grid gap-2">
      <Label>
        Header {format} <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">
        This template was approved with {format === "image" ? "an" : "a"} {format} header, so it
        won&apos;t send without one.
      </p>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "upload" | "link")
          // The two tabs are mutually exclusive server-side (link XOR mediaId),
          // so switching clears rather than silently keeping the other one.
          clear()
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="link">Use a URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="pt-3">
          {value?.mediaId ? (
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="truncate text-sm">{uploadedName ?? "Uploaded"}</span>
              <Button variant="ghost" size="sm" onClick={clear}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading…" : `Choose ${format === "image" ? "an" : "a"} ${format}`}
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {/* Meta's own ceiling for this category — the server enforces it too,
              and a deployment-level cap can be lower still. */}
          <p className="mt-2 text-xs text-muted-foreground">
            Up to {formatBytes(format === "image" ? 5 * 1024 * 1024 : format === "video" ? 16 * 1024 * 1024 : 100 * 1024 * 1024)}.
          </p>
        </TabsContent>

        <TabsContent value="link" className="space-y-2 pt-3">
          <Input
            value={value?.link ?? ""}
            onChange={(e) => {
              const link = e.target.value
              onChange(link.trim() ? { type: format, link: link.trim() } : undefined)
            }}
            placeholder={`https://cdn.example.com/header.${format === "image" ? "jpg" : format === "video" ? "mp4" : "pdf"}`}
          />
          <p className="text-xs text-muted-foreground">
            Meta fetches this itself, so it has to be publicly reachable.
            {allowTokens ? " You can use {{name}} or {{attributes.key}} for a per-contact file." : ""}
          </p>
        </TabsContent>
      </Tabs>

      {format === "document" && (value?.link || value?.mediaId) && (
        <div className="grid gap-1">
          <Label htmlFor="header-filename">Filename shown to the recipient</Label>
          <Input
            id="header-filename"
            value={value?.filename ?? ""}
            onChange={(e) => onChange({ ...(value as TemplateHeaderMedia), filename: e.target.value })}
            placeholder="invoice.pdf"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
