/**
 * How long Meta keeps a WhatsApp media file before deleting it. It depends on
 * who sent it: media a customer sends is kept for 7 days, media the business
 * uploads for 30 (Cloud API media reference).
 */
export function metaMediaRetentionDays(fromCustomer: boolean): number {
  return fromCustomer ? 7 : 30
}

/**
 * Whether a media message is old enough that Meta has deleted the file.
 *
 * Only meaningful once a load has already failed: media the server archived
 * in time still loads at any age. When it didn't, a retry can never succeed,
 * and saying so beats an endless "tap to retry".
 */
export function isPastMetaRetention(
  sentAt: Date | undefined,
  fromCustomer: boolean,
  now: number = Date.now(),
): boolean {
  if (!sentAt || Number.isNaN(sentAt.getTime())) return false
  return now - sentAt.getTime() > metaMediaRetentionDays(fromCustomer) * 24 * 60 * 60 * 1000
}
