"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Megaphone,
  Phone,
  Search,
  Send,
  Settings,
  Timer,
  Upload,
  Users,
  Workflow,
} from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

interface PaletteEntry {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** Extra search terms so plain-language queries land ("blast" → campaigns). */
  keywords?: string
}

const NAVIGATE: PaletteEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview stats" },
  { label: "Team inbox", href: "/dashboard/chat", icon: MessageSquare, keywords: "conversations replies chat messages" },
  { label: "Contacts", href: "/dashboard/contacts", icon: Users, keywords: "people customers crm list" },
  { label: "Segments", href: "/dashboard/segments", icon: Users, keywords: "audience filter group" },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone, keywords: "broadcast blast send bulk" },
  { label: "Automation", href: "/dashboard/automation", icon: Workflow, keywords: "rules triggers auto reply" },
  { label: "Drip sequences", href: "/dashboard/drips", icon: Timer, keywords: "journey followup nurture" },
  { label: "Chatbot flows", href: "/dashboard/flows", icon: Bot, keywords: "bot builder canvas" },
  { label: "WhatsApp forms", href: "/dashboard/whatsapp-flows", icon: FileText, keywords: "meta forms flow" },
  { label: "WhatsApp setup", href: "/dashboard/whatsapp", icon: Phone, keywords: "waba number connect onboarding meta" },
  { label: "Revenue", href: "/dashboard/revenue", icon: BarChart3, keywords: "sales roas conversions" },
  { label: "API usage", href: "/dashboard/api-usage", icon: BarChart3, keywords: "keys endpoints metrics" },
  { label: "Billing & wallet", href: "/dashboard/billing", icon: CreditCard, keywords: "balance top up invoice payment gst" },
  { label: "Docs", href: "/dashboard/docs", icon: FileText, keywords: "help guide documentation" },
  { label: "Glossary", href: "/dashboard/glossary", icon: FileText, keywords: "jargon meaning waba tier" },
  { label: "Support", href: "/dashboard/support", icon: LifeBuoy, keywords: "help ticket contact" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, keywords: "preferences account config" },
]

const ACTIONS: PaletteEntry[] = [
  { label: "Send a broadcast", href: "/dashboard/campaigns?new=1", icon: Send, keywords: "new campaign blast message" },
  { label: "Add a contact", href: "/dashboard/contacts?new=1", icon: Users, keywords: "new person create" },
  { label: "Import contacts", href: "/dashboard/contacts?import=1", icon: Upload, keywords: "csv upload bulk" },
  { label: "New segment", href: "/dashboard/segments/new", icon: Users, keywords: "audience filter create" },
  { label: "New chatbot flow", href: "/dashboard/flows/new", icon: Bot, keywords: "bot builder create" },
  { label: "Top up wallet", href: "/dashboard/billing", icon: CreditCard, keywords: "add money recharge balance" },
]

interface CommandPaletteContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

/** Opens the palette from anywhere — used by the mobile search affordance. */
export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>")
  return ctx
}

/**
 * ⌘K / Ctrl-K palette: jump to any section or start any common action from
 * anywhere in the dashboard.
 *
 * On phones there is no ⌘K, so the palette also has to be reachable by tap
 * (`CommandPaletteTrigger`) and it opens as a full-screen sheet sized in `dvh`
 * so the on-screen keyboard cannot push the input out of view.
 */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const toggle = useCallback(() => setOpen((prev) => !prev), [])
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            // Phone: full-screen sheet, dvh so the keyboard cannot clip it.
            // `max-h-none` opts out of DialogContent's viewport clamp, which
            // would otherwise leave a 2rem gap under a borderless full-bleed
            // sheet; the clamp is re-applied from `sm` up, where it floats.
            // `rounded-none border-0` needed `!` until `.surface-float` moved
            // into `@layer components`; it is an ordinary utility again now.
            "top-0 left-0 h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0",
            // Tablet and up: a floating surface near the top of the viewport.
            "sm:top-[12%] sm:left-[50%] sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-2xl sm:translate-x-[-50%] sm:rounded-float sm:border",
            "surface-float shadow-none sm:shadow-[var(--surface-shadow-float)]",
          )}
        >
          {/* Both sr-only: sighted users read the placeholder and the grouped
              list. A screen reader gets neither on open, and Radix warns when
              the description is missing rather than deliberately absent. */}
          <DialogTitle className="sr-only">Search and commands</DialogTitle>
          <DialogDescription className="sr-only">
            Type to search pages and contacts, or run a command. Use the arrow keys to move
            through results and Enter to choose one.
          </DialogDescription>
          <Command
            loop
            className="bg-transparent [&_[cmdk-input-wrapper]]:h-14 [&_[cmdk-input-wrapper]]:px-4"
          >
            <CommandInput placeholder="Search or type a command…" />
            <CommandList className="max-h-[calc(100dvh-3.5rem)] sm:max-h-[60vh]">
              <CommandEmpty>Nothing matched. Try “contacts”, “broadcast”, or “balance”.</CommandEmpty>

              <CommandGroup heading="Do something">
                {ACTIONS.map((entry) => (
                  <CommandItem
                    key={entry.href + entry.label}
                    value={`${entry.label} ${entry.keywords ?? ""}`}
                    onSelect={() => go(entry.href)}
                    className="gap-3 py-3"
                  >
                    <entry.icon className="h-4 w-4 text-primary" />
                    {entry.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Go to">
                {NAVIGATE.map((entry) => (
                  <CommandItem
                    key={entry.href + entry.label}
                    value={`${entry.label} ${entry.keywords ?? ""}`}
                    onSelect={() => go(entry.href)}
                    className="gap-3 py-3"
                  >
                    <entry.icon className="h-4 w-4 text-muted-foreground" />
                    {entry.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  )
}

/**
 * Visible way in. Shows the ⌘K hint on pointer-fine devices and stays a plain
 * tappable search control on touch, where the shortcut does not exist.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { setOpen } = useCommandPalette()
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent))
  }, [])

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "surface-raised focus-ring flex h-11 min-h-[44px] w-full items-center gap-2 px-3 text-sm text-muted-foreground",
        "transition-colors duration-fast ease-out-soft hover:border-primary/30 hover:text-foreground",
        "sm:h-9 sm:min-h-0 sm:w-64",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="truncate">Search or jump to…</span>
      <kbd className="ml-auto hidden shrink-0 rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
        {isMac ? "⌘" : "Ctrl"}K
      </kbd>
    </button>
  )
}
