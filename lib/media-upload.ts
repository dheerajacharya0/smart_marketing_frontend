/**
 * Client-side mirror of the backend's media upload rules
 * (`src/wassup/media-upload.ts`), which mirror Meta's.
 *
 * Checked here so a 40MB video fails instantly with the actual limit named,
 * instead of after uploading 40MB to be told no. The server still enforces
 * everything — it sniffs the leading bytes rather than trusting the browser's
 * `File.type`, which this cannot do — so treat these as a fast path, never as
 * the guarantee.
 */

export type MediaCategory = "image" | "video" | "audio" | "document" | "sticker"

export const MEDIA_CATEGORIES: readonly MediaCategory[] = [
  "image",
  "video",
  "audio",
  "document",
  "sticker",
]

/** Exactly the MIME types the server accepts per category. */
export const ALLOWED_MIME: Record<MediaCategory, readonly string[]> = {
  image: ["image/jpeg", "image/png"],
  video: ["video/mp4", "video/3gp", "video/3gpp"],
  audio: ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg", "audio/opus"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
  sticker: ["image/webp"],
}

/** Meta's per-category ceilings, in bytes. */
export const MAX_BYTES: Record<MediaCategory, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  sticker: 500 * 1024,
}

/**
 * The server also caps every upload at `MEDIA_UPLOAD_MAX_BYTES` (16MB by
 * default) because the file is held in memory to be forwarded. That cap is a
 * deployment setting we can't read, so a document between 16MB and Meta's 100MB
 * can still be refused server-side — don't promise the category limit as if it
 * were the only one.
 */
export const LIKELY_SERVER_CAP_BYTES = 16 * 1024 * 1024

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes} bytes`
}

/**
 * Which category a file belongs to, from its MIME type. Returns null for
 * anything WhatsApp can't carry — an unsupported file should be refused by
 * name, not silently uploaded as a "document".
 *
 * Order matters: `image/webp` is a sticker, so images are matched after it.
 */
export function categoryForFile(file: { type?: string }): MediaCategory | null {
  const mime = (file.type || "").split(";")[0].trim().toLowerCase()
  if (!mime) return null
  for (const category of ["sticker", "image", "video", "audio", "document"] as const) {
    if ((ALLOWED_MIME[category] as readonly string[]).includes(mime)) return category
  }
  return null
}

export interface MediaCheck {
  category: MediaCategory
  /** Null when the file passes every check we can run in the browser. */
  error: string | null
}

/**
 * Category + the reason it can't be sent, if any. One function so the drop
 * zone, the file picker and the header-media control all refuse identically.
 */
export function checkMediaFile(file: { name?: string; type?: string; size: number }): MediaCheck | null {
  const category = categoryForFile(file)
  if (!category) return null

  const max = MAX_BYTES[category]
  if (file.size > max) {
    return {
      category,
      error: `${category === "sticker" ? "Stickers" : `${category[0].toUpperCase()}${category.slice(1)}s`} can be at most ${formatBytes(max)} — this one is ${formatBytes(file.size)}.`,
    }
  }
  if (file.size === 0) {
    return { category, error: "That file is empty." }
  }
  return { category, error: null }
}

/** Human list of what can be dropped, for empty states and error copy. */
export function supportedMediaSummary(): string {
  return "JPEG or PNG images, MP4 video, common audio, PDF and Office documents"
}
