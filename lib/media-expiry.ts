/** How long Meta keeps a WhatsApp media file before deleting it. */
export const META_MEDIA_RETENTION_DAYS = 30

/**
 * Whether a media message is old enough that Meta has deleted the file.
 *
 * Only meaningful once a load has already failed: media the server archived
 * in time still loads at any age. When it didn't, a retry can never succeed,
 * and saying so beats an endless "tap to retry".
 */
export function isPastMetaRetention(sentAt: Date | undefined, now: number = Date.now()): boolean {
  if (!sentAt || Number.isNaN(sentAt.getTime())) return false
  return now - sentAt.getTime() > META_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000
}
