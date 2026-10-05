/**
 * WhatsApp media kept on this device, in the browser's Cache Storage.
 *
 * The server archive is what keeps media alive past Meta's 30 days; this is
 * the speed-up on top: a photo opened once loads instantly the next time,
 * across reloads and offline. It is per device and per browser — never the
 * only copy of anything.
 *
 * Every call is best-effort. Cache Storage is missing in some contexts (an
 * insecure origin, some private modes, jsdom) and can throw on quota; any of
 * that degrades to "not cached", never to a broken bubble.
 */

const CACHE_NAME = "whatsapp-media-v1"

function available(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined"
}

// Never a real network URL: the key only has to be unique and same-origin.
function keyFor(mediaId: string, accountId: string): string {
  return `/__media-cache/${encodeURIComponent(accountId)}/${encodeURIComponent(mediaId)}`
}

let persistenceRequested = false

/**
 * Ask the browser not to evict our storage under pressure. Chrome on Android
 * grants it to sites people use (installed, bookmarked, notifications on);
 * a refusal just means the cache may be cleared when the phone runs low.
 */
function requestPersistence(): void {
  if (persistenceRequested) return
  persistenceRequested = true
  try {
    void navigator.storage?.persist?.().catch(() => undefined)
  } catch {
    // unsupported — fine
  }
}

export async function readCachedMedia(mediaId: string, accountId: string): Promise<Blob | null> {
  if (!available()) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(keyFor(mediaId, accountId))
    return hit ? await hit.blob() : null
  } catch {
    return null
  }
}

export async function writeCachedMedia(mediaId: string, accountId: string, blob: Blob): Promise<void> {
  if (!available()) return
  requestPersistence()
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(
      keyFor(mediaId, accountId),
      new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream" } }),
    )
  } catch {
    // quota exceeded or storage blocked — the file still shows this session
  }
}

/**
 * Drop every cached file. Called on sign-out: these are customers' photos and
 * documents, and a shared or lost device must not keep them after the session
 * that was allowed to see them has ended.
 */
export async function clearCachedMedia(): Promise<void> {
  if (!available()) return
  try {
    await caches.delete(CACHE_NAME)
  } catch {
    // nothing to clear
  }
}
