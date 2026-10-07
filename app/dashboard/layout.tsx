"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { useScrollRestoration } from "@/hooks/use-scroll-restoration"
import { cn } from "@/lib/utils"
import { isAuthenticated } from "@/services/api"
import UnifiedSidebar from "@/components/unified-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { WalletExhaustedProvider } from "@/components/billing/wallet-exhausted-provider"
import { CallCenter } from "@/components/calls/call-center"
import { LowBalanceBanner } from "@/components/billing/low-balance-banner"
import { PendingInvitesBanner } from "@/components/team/pending-invites-banner"
import { CommandPaletteProvider } from "@/components/command-palette"
import { TopBar } from "@/components/layout/top-bar"
import { MobileTabBar } from "@/components/layout/mobile-tab-bar"
import { AppBackground } from "@/components/ui/surface"
import { AccessGate } from "@/components/access-gate"
import { useActiveNumber, useNumberEpoch } from "@/hooks/use-active-number"
import { routeAfterNumberSwitch } from "@/lib/number-switch-route"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile)
  const pathname = usePathname()
  // Chat wants the full pane (its own scroll regions, conversation list + thread side by side) —
  // skip the padded container the rest of the dashboard sections use.
  const isFullBleed = pathname?.startsWith("/dashboard/chat")
  // Switching the active number re-mounts the page (see use-active-number),
  // so everything on it reads the new number. Followed across tabs here, once.
  useActiveNumber({ followOtherTabs: true })
  const numberEpoch = useNumberEpoch()
  const router = useRouter()
  // `main` below is the actual scroll container (not `window`), and it never
  // remounts between sibling dashboard routes — so the browser's native
  // scroll restoration, which only tracks `window`, never restores it.
  const mainRef = useRef<HTMLElement>(null)
  useScrollRestoration(mainRef)

  // A page holding the previous number's id in its URL would re-mount onto
  // that same id; send it to a page that resolves the new one instead. Keyed
  // on the epoch alone: it is 0 until the first switch, so plain navigation
  // never triggers this.
  useEffect(() => {
    if (numberEpoch === 0) return
    const next = routeAfterNumberSwitch(window.location.pathname)
    if (next) router.replace(next)
  }, [numberEpoch, router])

  // Second line only. `middleware.ts` is the real gate for /dashboard/*: an
  // unauthenticated request is redirected at the edge and never reaches this
  // component, so what's left for the client is the case where the session
  // marker expires or is cleared mid-visit.
  //
  // It deliberately no longer withholds the tree behind a state flag. That
  // pattern server-rendered every dashboard route as empty and made the entire
  // area depend on one effect flipping one boolean — and in a production build
  // `requireAuth()` optimised away to `undefined`, so the flag never flipped
  // and every page rendered blank, with no error and no redirect to explain it.
  // A guard that can fail closed over the whole product is worse than the flash
  // of content it was added to prevent.
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/login"
    }
  }, [])

  // Update sidebar state when screen size changes
  useEffect(() => {
    setIsSidebarOpen(!isMobile)
  }, [isMobile])

  return (
    <SidebarProvider defaultOpen={!isMobile} open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <CommandPaletteProvider>
        {/* Page-level atmosphere sits behind everything, fixed, non-interactive. */}
        <AppBackground />

        {/* `dvh`, not `svh`: the shell has to track the browser's current
            viewport, or when iOS Safari collapses its toolbar the page ends
            short of the screen and a blank strip shows underneath. */}
        <div className="relative z-10 flex h-dvh w-full overflow-hidden">
          <UnifiedSidebar />
          <SidebarInset className="min-w-0 bg-transparent">
            <div className="flex h-full flex-col overflow-hidden">
              <TopBar />
              {/* A flex column so a full-bleed child gets a definite height to
                  fill: the wallet banner takes what it needs and the page takes
                  the rest, instead of the page assuming the whole viewport and
                  overflowing by the height of the banner. */}
              <main
                ref={mainRef}
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  isFullBleed ? "overflow-hidden" : "overflow-auto",
                )}
              >
                {/* Feature 3D — global empty-wallet banner */}
                <LowBalanceBanner />
                <PendingInvitesBanner />
                {isFullBleed ? (
                  <div className="min-h-0 flex-1">
                    <AccessGate key={numberEpoch}>{children}</AccessGate>
                  </div>
                ) : (
                  <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7")}>
                    <AccessGate key={numberEpoch}>{children}</AccessGate>
                  </div>
                )}
              </main>
              {/* In flow under `main`, not `position: fixed` — iOS 26 Safari
                  leaves fixed-bottom elements stranded above the screen edge
                  when its toolbar collapses. */}
              <MobileTabBar />
            </div>
          </SidebarInset>
        </div>

        {/* Feature 3 — global 402 top-up prompt */}
        <WalletExhaustedProvider />
        {/* Incoming WhatsApp calls ring on every dashboard page. */}
        <CallCenter />
      </CommandPaletteProvider>
    </SidebarProvider>
  )
}
