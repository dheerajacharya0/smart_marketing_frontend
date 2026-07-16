import { fetchWhatsappMediaBlob } from "@/services/api"

// Session-scoped object-URL cache keyed by mediaId, so a media file is
// downloaded through the auth proxy once per session no matter how many
// bubbles/lightboxes reference it. Failed fetches are evicted so retry works.
const cache = new Map<string, Promise<string>>()

export function getMediaObjectUrl(mediaId: string, accountId: string): Promise<string> {
  const cached = cache.get(mediaId)
  if (cached) return cached

  const promise = fetchWhatsappMediaBlob(mediaId, accountId)
    .then((blob) => URL.createObjectURL(blob))
    .catch((err) => {
      cache.delete(mediaId)
      throw err
    })
  cache.set(mediaId, promise)
  return promise
}
