"use client"

import { useMemo, useState } from "react"
import { Smile } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

/**
 * Emoji picker.
 *
 * Deliberately a curated set rather than a full Unicode index pulled in as a
 * dependency: the full set is ~1.5MB of data plus a virtualised grid, and this
 * is a business inbox — the long tail of flags and profession modifiers is not
 * what anyone reaches for when answering "is the cake eggless?". Each entry
 * carries keywords so search finds it by what it means, not by its Unicode name.
 */

interface Emoji {
  char: string
  keywords: string
}

interface EmojiGroup {
  name: string
  emoji: Emoji[]
}

const GROUPS: EmojiGroup[] = [
  {
    name: "Reactions",
    emoji: [
      { char: "😀", keywords: "grin smile happy" },
      { char: "😊", keywords: "smile blush happy warm" },
      { char: "😅", keywords: "sweat laugh relief phew" },
      { char: "😂", keywords: "laugh tears funny lol" },
      { char: "🙂", keywords: "slight smile polite" },
      { char: "😉", keywords: "wink joke" },
      { char: "😍", keywords: "love heart eyes adore" },
      { char: "🤩", keywords: "star struck excited wow" },
      { char: "😘", keywords: "kiss love" },
      { char: "🤗", keywords: "hug welcome" },
      { char: "🤔", keywords: "think hmm consider" },
      { char: "😐", keywords: "neutral straight face" },
      { char: "😴", keywords: "sleep tired" },
      { char: "😢", keywords: "sad cry tear" },
      { char: "😭", keywords: "sob cry very sad" },
      { char: "😳", keywords: "flushed surprise embarrassed" },
      { char: "😬", keywords: "grimace awkward yikes" },
      { char: "🥲", keywords: "smile tear bittersweet" },
      { char: "😇", keywords: "angel innocent halo" },
      { char: "🤣", keywords: "rofl laughing hard" },
    ],
  },
  {
    name: "Gestures",
    emoji: [
      { char: "👍", keywords: "thumbs up yes ok approve good" },
      { char: "👎", keywords: "thumbs down no reject" },
      { char: "👌", keywords: "ok perfect fine" },
      { char: "🙏", keywords: "thanks please pray grateful" },
      { char: "👏", keywords: "clap applause well done" },
      { char: "🙌", keywords: "celebrate hooray raised hands" },
      { char: "🤝", keywords: "handshake deal agree" },
      { char: "💪", keywords: "strong power muscle" },
      { char: "✌️", keywords: "peace victory" },
      { char: "🤞", keywords: "fingers crossed hope luck" },
      { char: "👋", keywords: "wave hello hi bye" },
      { char: "☝️", keywords: "point up one note" },
      { char: "👇", keywords: "point down below" },
      { char: "👉", keywords: "point right this" },
      { char: "✋", keywords: "stop hand wait" },
      { char: "🫶", keywords: "heart hands love thanks" },
    ],
  },
  {
    name: "Business",
    emoji: [
      { char: "✅", keywords: "check done complete yes confirmed" },
      { char: "❌", keywords: "cross no cancel wrong" },
      { char: "⚠️", keywords: "warning caution careful" },
      { char: "❗", keywords: "important exclamation urgent" },
      { char: "❓", keywords: "question ask" },
      { char: "📦", keywords: "package parcel order shipping box" },
      { char: "🚚", keywords: "delivery truck shipping dispatch" },
      { char: "🧾", keywords: "receipt invoice bill" },
      { char: "💳", keywords: "card payment pay" },
      { char: "💰", keywords: "money price cost payment" },
      { char: "🏷️", keywords: "price tag label offer discount" },
      { char: "📅", keywords: "calendar date schedule booking" },
      { char: "⏰", keywords: "time clock reminder alarm" },
      { char: "📍", keywords: "location address pin map" },
      { char: "📞", keywords: "phone call ring" },
      { char: "📧", keywords: "email mail" },
      { char: "🔗", keywords: "link url" },
      { char: "📝", keywords: "note write form details" },
      { char: "🆕", keywords: "new" },
      { char: "🔥", keywords: "hot popular trending offer" },
    ],
  },
  {
    name: "Things",
    emoji: [
      { char: "🎉", keywords: "party celebrate congrats launch" },
      { char: "🎁", keywords: "gift present offer" },
      { char: "⭐", keywords: "star rating favourite review" },
      { char: "❤️", keywords: "heart love red" },
      { char: "🧡", keywords: "heart orange" },
      { char: "💚", keywords: "heart green" },
      { char: "☕", keywords: "coffee cafe drink" },
      { char: "🍰", keywords: "cake dessert bakery slice" },
      { char: "🎂", keywords: "birthday cake celebrate" },
      { char: "🍕", keywords: "pizza food" },
      { char: "🍔", keywords: "burger food" },
      { char: "🥗", keywords: "salad healthy food" },
      { char: "👗", keywords: "dress clothes fashion" },
      { char: "👟", keywords: "shoes sneakers footwear" },
      { char: "💄", keywords: "makeup beauty cosmetics" },
      { char: "🏠", keywords: "home house property" },
      { char: "🚗", keywords: "car vehicle drive" },
      { char: "✈️", keywords: "flight travel plane" },
      { char: "🌿", keywords: "plant leaf natural organic" },
      { char: "🐾", keywords: "pet paw animal" },
    ],
  },
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  disabled?: boolean
}

export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS.map((group) => ({
      ...group,
      emoji: group.emoji.filter((e) => e.keywords.includes(q)),
    })).filter((group) => group.emoji.length > 0)
  }, [query])

  const pick = (char: string) => {
    onSelect(char)
    // The popover stays open: picking two or three in a row is normal, and
    // reopening it each time would be the annoying half of that.
    setQuery("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          title="Emoji"
          aria-label="Insert emoji"
          disabled={disabled}
          className={cn(open && "bg-accent text-accent-foreground")}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-0">
        <div className="border-b border-border-subtle p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — try “thanks”, “order”, “done”"
            className="h-8"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="space-y-3 p-2">
            {results.length === 0 ? (
              <p className="px-1 py-8 text-center text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
            ) : (
              results.map((group) => (
                <div key={group.name}>
                  <p className="px-1 pb-1 text-xs font-medium uppercase tracking-label text-muted-foreground">
                    {group.name}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {group.emoji.map((emoji) => (
                      <button
                        key={emoji.char}
                        type="button"
                        onClick={() => pick(emoji.char)}
                        aria-label={emoji.keywords.split(" ")[0]}
                        className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors duration-fast ease-out-soft hover:bg-accent"
                      >
                        {emoji.char}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
