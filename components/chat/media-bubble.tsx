"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FileText, ImageOff, Loader2, Play, RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { MessageMedia } from "@/hooks/use-chat-messages"
import { getMediaObjectUrl } from "@/lib/whatsapp-media-cache"
import { getWhatsappMediaMetadata } from "@/services/api"

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type LoadState = "idle" | "loading" | "ready" | "error"

// Resolves the displayable URL for a media message: outbound-by-link renders
// the user-supplied public URL directly; everything else goes through the
// authenticated download proxy and an object URL.
function useMediaSource(media: MessageMedia, accountId: string, autoLoad: boolean) {
  const [src, setSrc] = useState<string | null>(media.link || null)
  const [state, setState] = useState<LoadState>(media.link ? "ready" : "idle")
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    if (media.link) return
    if (!media.id) {
      setState("error")
      return
    }
    setState("loading")
    getMediaObjectUrl(media.id, accountId)
      .then((url) => {
        setSrc(url)
        setState("ready")
      })
      .catch(() => setState("error"))
  }, [media.id, media.link, accountId])

  // Lazy-load: only start fetching bytes once the bubble scrolls into view.
  useEffect(() => {
    if (!autoLoad || media.link || !media.id) return
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load()
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [autoLoad, media.id, media.link, load])

  return { src, state, load, containerRef }
}

function MediaErrorPlaceholder({
  onRetry,
  className,
}: {
  onRetry: () => void
  className: string
}) {
  return (
    <button
      onClick={onRetry}
      className={`flex flex-col items-center justify-center gap-1 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 ${className}`}
      title="Retry"
    >
      <ImageOff className="h-5 w-5" />
      <span className="text-xs">Media unavailable</span>
      <RefreshCw className="h-3.5 w-3.5" />
    </button>
  )
}

function LoadingPlaceholder({ className }: { className: string }) {
  return (
    <div className={`flex items-center justify-center rounded-md bg-muted ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function Caption({ media }: { media: MessageMedia }) {
  if (!media.caption) return null
  return <p className="text-sm whitespace-pre-wrap break-words mt-1">{media.caption}</p>
}

function ImageBubble({ media, accountId }: { media: MessageMedia; accountId: string }) {
  const { src, state, load, containerRef } = useMediaSource(media, accountId, true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const isSticker = media.type === "sticker"
  const sizeClass = isSticker ? "h-28 w-28" : "h-48 w-64 max-w-full"

  return (
    <div ref={containerRef}>
      {state === "error" ? (
        <MediaErrorPlaceholder onRetry={load} className={sizeClass} />
      ) : state !== "ready" || !src ? (
        <LoadingPlaceholder className={sizeClass} />
      ) : (
        <>
          <img
            src={src}
            alt={media.caption || media.type}
            className={`${sizeClass} rounded-md object-cover ${isSticker ? "" : "cursor-pointer"}`}
            onClick={() => !isSticker && setLightboxOpen(true)}
          />
          {!isSticker && (
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
              <DialogContent className="max-w-3xl p-2">
                <DialogTitle className="sr-only">{media.caption || "Image"}</DialogTitle>
                <img src={src} alt={media.caption || "image"} className="max-h-[80vh] w-full object-contain rounded" />
                {media.caption && <p className="text-sm text-center text-muted-foreground">{media.caption}</p>}
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
      {!isSticker && <Caption media={media} />}
    </div>
  )
}

function VideoBubble({ media, accountId }: { media: MessageMedia; accountId: string }) {
  const { src, state, load, containerRef } = useMediaSource(media, accountId, false)
  const sizeClass = "h-48 w-64 max-w-full"

  return (
    <div ref={containerRef}>
      {state === "error" ? (
        <MediaErrorPlaceholder onRetry={load} className={sizeClass} />
      ) : state === "ready" && src ? (
        <video src={src} controls autoPlay={!media.link} className={`${sizeClass} rounded-md bg-black`} />
      ) : (
        <button
          onClick={load}
          disabled={state === "loading"}
          className={`flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 ${sizeClass}`}
          title="Load video"
        >
          {state === "loading" ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
              <Play className="h-6 w-6" />
            </span>
          )}
        </button>
      )}
      <Caption media={media} />
    </div>
  )
}

function AudioBubble({ media, accountId }: { media: MessageMedia; accountId: string }) {
  const { src, state, load, containerRef } = useMediaSource(media, accountId, false)
  const sizeClass = "h-12 w-64 max-w-full"

  return (
    <div ref={containerRef}>
      {state === "error" ? (
        <MediaErrorPlaceholder onRetry={load} className={sizeClass} />
      ) : state === "ready" && src ? (
        <audio controls src={src} className="w-64 max-w-full" />
      ) : (
        <button
          onClick={load}
          disabled={state === "loading"}
          className={`flex items-center justify-center gap-2 rounded-md bg-muted text-sm text-muted-foreground hover:bg-muted/80 ${sizeClass}`}
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Voice / audio message
        </button>
      )}
    </div>
  )
}

function DocumentBubble({ media, accountId }: { media: MessageMedia; accountId: string }) {
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Metadata (file size) is a cheap JSON call — fetch when visible.
  useEffect(() => {
    if (!media.id) return
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          getWhatsappMediaMetadata(media.id!, accountId)
            .then((res) => {
              if (res?.file_size != null) setFileSize(Number(res.file_size))
            })
            .catch(() => {})
          observer.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [media.id, accountId])

  const handleDownload = async () => {
    setError(false)
    try {
      let url = media.link
      if (!url) {
        if (!media.id) throw new Error("no media id")
        setDownloading(true)
        url = await getMediaObjectUrl(media.id, accountId)
      }
      const a = document.createElement("a")
      a.href = url
      a.download = media.filename || "document"
      a.target = "_blank"
      a.click()
    } catch {
      setError(true)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div ref={containerRef}>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex h-16 w-64 max-w-full items-center gap-3 rounded-md bg-muted p-3 text-left hover:bg-muted/80"
      >
        {error ? <ImageOff className="h-6 w-6 shrink-0 text-muted-foreground" /> : <FileText className="h-6 w-6 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{media.filename || "Document"}</span>
          <span className="block text-xs text-muted-foreground">
            {error ? "Media unavailable — tap to retry" : formatBytes(fileSize) || "Document"}
          </span>
        </span>
        {downloading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      <Caption media={media} />
    </div>
  )
}

export function MediaBubble({ media, accountId }: { media: MessageMedia; accountId: string }) {
  switch (media.type) {
    case "image":
    case "sticker":
      return <ImageBubble media={media} accountId={accountId} />
    case "video":
      return <VideoBubble media={media} accountId={accountId} />
    case "audio":
      return <AudioBubble media={media} accountId={accountId} />
    case "document":
      return <DocumentBubble media={media} accountId={accountId} />
    default:
      return null
  }
}
