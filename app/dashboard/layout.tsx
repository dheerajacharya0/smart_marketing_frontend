"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { requireAuth } from "@/lib/auth"
import UnifiedSidebar from "@/components/unified-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { WalletExhaustedProvider } from "@/components/billing/wallet-exhausted-provider"
import { LowBalanceBanner } from "@/components/billing/low-balance-banner"
import { CommandPaletteProvider } from "@/components/command-palette"
import { TopBar } from "@/components/layout/top-bar"
import { AppBackground } from "@/components/ui/surface"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const pathname = usePathname()
  // Chat wants the full pane (its own scroll regions, conversation list + thread side by side) —
  // skip the padded container the rest of the dashboard sections use.
  const isFullBleed = pathname?.startsWith("/dashboard/chat")

  // Whole dashboard tree is the authenticated area — redirects to /login if no authToken.
  // Don't render children until this passes, so an unauthenticated visitor never sees a flash of dashboard content.
  useEffect(() => {
    setIsAuthorized(requireAuth())
  }, [])

  // Update sidebar state when screen size changes
  useEffect(() => {
    setIsSidebarOpen(!isMobile)
  }, [isMobile])

  if (!isAuthorized) return null

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

        {/* Feature 3 — global 402 top-up prompt */}
        <WalletExhaustedProvider />
      </CommandPaletteProvider>
    </SidebarProvider>
  )
}
