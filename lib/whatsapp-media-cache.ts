import { fetchWhatsappMediaBlob } from "@/services/api"
import { readCachedMedia, writeCachedMedia } from "@/lib/media-device-cache"

// Session-scoped object-URL cache keyed by mediaId, so a media file is
// resolved once per session no matter how many bubbles/lightboxes reference
// it. Behind it, the device cache (lib/media-device-cache) keeps the bytes
// across reloads, so only a file never opened on this device goes to the
// network. Failed fetches are evicted so retry works.
const cache = new Map<string, Promise<string>>()

async function resolveBlob(mediaId: string, accountId: string): Promise<Blob> {
  const cached = await readCachedMedia(mediaId, accountId)
  if (cached) return cached
  const blob = await fetchWhatsappMediaBlob(mediaId, accountId)
  // Not awaited: storing for next time must not delay showing it now.
  void writeCachedMedia(mediaId, accountId, blob)
  return blob
}

export function getMediaObjectUrl(mediaId: string, accountId: string): Promise<string> {
  const cached = cache.get(mediaId)
  if (cached) return cached

  const promise = resolveBlob(mediaId, accountId)
    .then((blob) => URL.createObjectURL(blob))
    .catch((err) => {
      cache.delete(mediaId)
      throw err
    })
  cache.set(mediaId, promise)
  return promise
}
