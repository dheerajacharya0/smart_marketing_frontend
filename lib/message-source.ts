import type { MessageSource } from "@/services/api"

/**
 * Plain-language names for the feature that caused a charge. The backend's
 * values (`src/common/message-source.ts`) are internal identifiers — "wassup",
 * "manual", "system" mean nothing to a shop owner reading their statement.
 *
 * `unattributed` is not a feature: it's every debit written before attribution
 * existed. It can never be filled in retroactively (the charge arrives on a
 * status webhook that only knows a wamid), so it shrinks over time rather than
 * disappearing, and saying so is more honest than labelling it "Other".
 */
export type UsageSource = MessageSource | "unattributed"

const LABELS: Record<UsageSource, string> = {
  campaign: "Broadcasts",
  drip: "Drip sequences",
  automation: "Auto-replies",
  flow: "Bot flows",
  manual: "Inbox replies",
  system: "Opt-in confirmations",
  api: "Your API",
  unattributed: "Before tracking",
}

const DESCRIPTIONS: Record<UsageSource, string> = {
  campaign: "Messages sent by a broadcast campaign.",
  drip: "Steps sent by a drip sequence.",
  automation: "Replies sent by an automation rule.",
  flow: "Messages sent by a chatbot flow.",
  manual: "Messages an agent typed in the team inbox.",
  system: "Our own opt-in and opt-out confirmations.",
  api: "Messages sent through your own API key.",
  unattributed: "Charges from before we started recording which feature caused them.",
}

export function sourceLabel(source: UsageSource | null | undefined): string {
  if (!source) return "—"
  return LABELS[source] ?? source
}

export function sourceDescription(source: UsageSource | null | undefined): string {
  if (!source) return ""
  return DESCRIPTIONS[source] ?? ""
}

/** Share of total spend, 0–100. Guards the empty-wallet case rather than yielding NaN. */
export function sharePercent(charged: number, total: number): number {
  if (!Number.isFinite(charged) || !Number.isFinite(total) || total <= 0) return 0
  return (charged / total) * 100
}
