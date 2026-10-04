"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Phone, Plus } from "lucide-react"
import { toast } from "react-hot-toast"
import { useActiveNumber } from "@/hooks/use-active-number"
import { cn } from "@/lib/utils"
import type { WhatsappContext } from "@/services/api"

/**
 * The number as people know it. Meta's id is a 15-digit string that looks like
 * a phone number and isn't one, so when Meta hasn't told us the real number
 * yet, say so instead of showing it.
 */
export function numberLabel(n: WhatsappContext) {
  return n.displayPhoneNumber || n.verifiedName || `Number ending ${n.phoneNumberId.slice(-4)}`
}

/**
 * The active WhatsApp number, and the switch between numbers, in the sidebar
 * header — the one control that changes which number chat, campaigns,
 * templates and analytics work on.
 *
 * An inline list, not a Select or dropdown: on a phone the sidebar is itself a
 * sheet, and a menu layered inside a dialog has closed the dialog on a real
 * Android tap before (see components/ui/dialog.tsx).
 */
export function NumberSwitcher() {
  const { active, numbers, switchNumber, isLoading } = useActiveNumber()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape — the list sits over the nav below it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (isLoading || !active) return null

  const several = numbers.length > 1
  const pick = (n: WhatsappContext) => {
    setOpen(false)
    if (n.phoneNumberId === active.phoneNumberId) return
    switchNumber(n.phoneNumberId)
    toast.success(`Now working on ${n.verifiedName ? `${n.verifiedName} · ` : ""}${numberLabel(n)}`)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => several && setOpen((v) => !v)}
        aria-expanded={several ? open : undefined}
        aria-haspopup={several ? "listbox" : undefined}
        aria-label={`Active number ${numberLabel(active)}${several ? ", change number" : ""}`}
        className={cn(
          "focus-ring flex w-full min-w-0 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-left",
          several ? "hover:bg-sidebar-accent" : "cursor-default",
        )}
      >
        <Phone className="h-3.5 w-3.5 shrink-0 text-sidebar-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium tabular-nums text-sidebar-foreground">
            {numberLabel(active)}
          </span>
          {active.verifiedName && (
            <span className="block truncate text-[0.6875rem] text-sidebar-muted-foreground">
              {active.verifiedName}
            </span>
          )}
        </span>
        {several && (
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-muted-foreground transition-transform", open && "rotate-180")}
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="WhatsApp numbers"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-sidebar-border bg-popover p-1 shadow-lg"
        >
          {numbers.map((n) => {
            const selected = n.phoneNumberId === active.phoneNumberId
            return (
              <button
                key={n.phoneNumberId}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => pick(n)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent",
                  selected && "bg-accent/60",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium tabular-nums">{numberLabel(n)}</span>
                  {n.verifiedName && (
                    <span className="block truncate text-[0.6875rem] text-muted-foreground">{n.verifiedName}</span>
                  )}
                </span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            )
          })}
          <Link
            href="/dashboard/whatsapp/new"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded border-t px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add a number
          </Link>
        </div>
      )}
    </div>
  )
}
