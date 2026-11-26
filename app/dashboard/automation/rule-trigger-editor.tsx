"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AutomationTrigger, AutomationTriggerType } from "@/services/api"
import { useAds } from "@/hooks/use-queries"
import { AD_PICKER_DAYS, adLabel } from "@/lib/ads"
import {
  AD_KEYS_MAX,
  KEYWORDS_MAX,
  NO_REPLY_HOURS_MAX,
  NO_REPLY_HOURS_MIN,
  TAG_MAX,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  TRIGGER_TYPES,
  defaultTrigger,
} from "@/lib/automation-rules"

/** Comma-separated list → trimmed, de-duplicated, empties dropped. */
function parseList(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split(",")) {
    const value = raw.trim()
    if (value) seen.add(value)
  }
  return [...seen]
}

/**
 * Which ads the `ad_click` trigger answers. None ticked = any ad, which is what
 * most accounts with one running ad want; ticking narrows it so each ad can get
 * its own reply.
 */
function AdKeysPicker({
  accountId,
  adKeys,
  onChange,
}: {
  accountId: string | null
  adKeys: string[]
  onChange: (adKeys: string[]) => void
}) {
  const { data: ads, isLoading, error } = useAds(accountId, AD_PICKER_DAYS)
  const known = new Set((ads ?? []).map((ad) => ad.adKey))
  // Saved on the rule but no longer in the window: still shown so unticking
  // it is possible, and so the rule doesn't silently look like "any ad".
  const stale = adKeys.filter((key) => !known.has(key))

  const toggle = (key: string, on: boolean) =>
    onChange(on ? [...adKeys, key].slice(0, AD_KEYS_MAX) : adKeys.filter((k) => k !== key))

  return (
    <div className="grid gap-2">
      <Label>Which ads</Label>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading your ads…</p>
      ) : error ? (
        <p className="text-xs text-destructive">
          Couldn&apos;t load your ads. The rule still works for any ad; reopen this to pick one.
        </p>
      ) : (ads ?? []).length === 0 && stale.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No chats have come from a Click-to-WhatsApp ad yet. Leave this as is to reply to any ad;
          once an ad brings in a chat you can pick it here.
        </p>
      ) : (
        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
          {(ads ?? []).map((ad) => (
            <label key={ad.adKey} className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={adKeys.includes(ad.adKey)}
                onCheckedChange={(v) => toggle(ad.adKey, v === true)}
              />
              <span className="min-w-0">
                <span className="block truncate">{adLabel(ad)}</span>
                <span className="block text-xs text-muted-foreground">
                  {ad.clicks} {ad.clicks === 1 ? "chat" : "chats"} in the last year
                </span>
              </span>
            </label>
          ))}
          {stale.map((key) => (
            <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked onCheckedChange={() => toggle(key, false)} />
              <span className="text-muted-foreground">Ad with no chats in the last year</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {adKeys.length === 0 ? "None ticked: replies to a chat from any ad." : `Replies only to chats from the ${adKeys.length === 1 ? "ticked ad" : `${adKeys.length} ticked ads`}.`}
      </p>
    </div>
  )
}

/**
 * "When should this run?" — one trigger, its own fields.
 *
 * The comma-separated inputs keep their raw text locally: parsing on every
 * keystroke and writing the array back would fight the caret the moment someone
 * types a comma. The parsed array is what leaves the component.
 */
export function RuleTriggerEditor({
  accountId,
  trigger,
  onChange,
  issues,
}: {
  /** The account the rule belongs to — the automation page's, for the ad list. */
  accountId: string | null
  trigger: AutomationTrigger
  onChange: (trigger: AutomationTrigger) => void
  issues: string[]
}) {
  const [listText, setListText] = useState(() =>
    trigger.type === "keyword"
      ? trigger.keywords.join(", ")
      : trigger.type === "button"
        ? trigger.buttonIds.join(", ")
        : ""
  )

  // Re-seed when the dialog switches to a different rule; the parent remounts
  // this on open, so this only fires for a trigger-type change.
  useEffect(() => {
    if (trigger.type === "keyword") setListText(trigger.keywords.join(", "))
    else if (trigger.type === "button") setListText(trigger.buttonIds.join(", "))
    else setListText("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger.type])

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-2">
        <Label>When this happens</Label>
        <Select
          value={trigger.type}
          onValueChange={(v) => onChange(defaultTrigger(v as AutomationTriggerType))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TRIGGER_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{TRIGGER_HINTS[trigger.type]}</p>
      </div>

      {trigger.type === "keyword" && (
        <>
          <div className="grid gap-2">
            <Label>Match</Label>
            <Select
              value={trigger.matchType}
              onValueChange={(v) =>
                onChange({ ...trigger, matchType: v as typeof trigger.matchType })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Message is exactly a keyword</SelectItem>
                <SelectItem value="contains">Message contains a keyword</SelectItem>
                <SelectItem value="any">Any message (catch-all)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trigger.matchType === "any" ? (
            <p className="text-xs text-muted-foreground">
              This replies to every message. Only the first matching rule fires, so give it a high
              priority number to keep it as the last resort.
            </p>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="trigger-keywords">Keywords (comma separated)</Label>
              <Input
                id="trigger-keywords"
                value={listText}
                onChange={(e) => {
                  setListText(e.target.value)
                  onChange({ ...trigger, keywords: parseList(e.target.value) })
                }}
                placeholder="hi, hello, hours"
              />
              <p className="text-xs text-muted-foreground">
                Case-insensitive. Up to {KEYWORDS_MAX}.
              </p>
            </div>
          )}
        </>
      )}

      {trigger.type === "button" && (
        <div className="grid gap-2">
          <Label htmlFor="trigger-buttons">Button ids (comma separated, optional)</Label>
          <Input
            id="trigger-buttons"
            value={listText}
            onChange={(e) => {
              setListText(e.target.value)
              onChange({ ...trigger, buttonIds: parseList(e.target.value) })
            }}
            placeholder="Leave empty for any button"
          />
          <p className="text-xs text-muted-foreground">
            The id you gave the button when you built the message, not its label.
          </p>
        </div>
      )}

      {trigger.type === "tag_added" && (
        <div className="grid gap-2">
          <Label htmlFor="trigger-tag">Tag</Label>
          <Input
            id="trigger-tag"
            value={trigger.tag}
            maxLength={TAG_MAX}
            onChange={(e) => onChange({ ...trigger, tag: e.target.value })}
            placeholder="vip"
          />
        </div>
      )}

      {trigger.type === "no_reply" && (
        <div className="grid gap-2">
          <Label htmlFor="trigger-hours">Hours of silence</Label>
          <Input
            id="trigger-hours"
            type="number"
            min={NO_REPLY_HOURS_MIN}
            max={NO_REPLY_HOURS_MAX}
            value={trigger.hours}
            onChange={(e) => onChange({ ...trigger, hours: Math.trunc(Number(e.target.value)) })}
          />
          <p className="text-xs text-muted-foreground">
            Counted from your last message. Past 24 hours only an approved template can be sent, so
            a text action will fail, use a template action for long waits.
          </p>
        </div>
      )}

      {trigger.type === "ad_click" && (
        <AdKeysPicker
          accountId={accountId}
          adKeys={trigger.adKeys}
          onChange={(adKeys) => onChange({ ...trigger, adKeys })}
        />
      )}

      {issues.map((message) => (
        <p key={message} className="text-xs text-destructive">
          {message}
        </p>
      ))}
    </div>
  )
}
