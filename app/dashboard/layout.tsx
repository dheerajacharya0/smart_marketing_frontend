"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { isAuthenticated } from "@/services/api"
import UnifiedSidebar from "@/components/unified-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { WalletExhaustedProvider } from "@/components/billing/wallet-exhausted-provider"
import { LowBalanceBanner } from "@/components/billing/low-balance-banner"
import { CommandPaletteProvider } from "@/components/command-palette"
import { TopBar } from "@/components/layout/top-bar"
import { MobileTabBar, showsMobileTabBar } from "@/components/layout/mobile-tab-bar"
import { AppBackground } from "@/components/ui/surface"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile)
  const pathname = usePathname()
  // Chat wants the full pane (its own scroll regions, conversation list + thread side by side) —
  // skip the padded container the rest of the dashboard sections use.
  const isFullBleed = pathname?.startsWith("/dashboard/chat")
  const hasTabBar = showsMobileTabBar(pathname)

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

        <div className="relative z-10 flex h-svh w-full overflow-hidden">
          <UnifiedSidebar />
          <SidebarInset className="min-w-0 bg-transparent">
            <div className="flex h-full flex-col overflow-hidden">
              <TopBar />
              {/* A flex column so a full-bleed child gets a definite height to
                  fill: the wallet banner takes what it needs and the page takes
                  the rest, instead of the page assuming the whole viewport and
                  overflowing by the height of the banner. */}
              <main
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  isFullBleed ? "overflow-hidden" : "overflow-auto",
                  // Room for the phone tab bar, so the last row of a page is
                  // never stuck underneath it.
                  hasTabBar && "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
                )}
              >
                {/* Feature 3D — global empty-wallet banner */}
                <LowBalanceBanner />
                {isFullBleed ? (
                  <div className="min-h-0 flex-1">{children}</div>
                ) : (
                  <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7")}>
                    {children}
                  </div>
                )}
              </main>
            </div>
          </SidebarInset>
        </div>

        <MobileTabBar />

        {/* Feature 3 — global 402 top-up prompt */}
        <WalletExhaustedProvider />
      </CommandPaletteProvider>
    </SidebarProvider>
  )
}
