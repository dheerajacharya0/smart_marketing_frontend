"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { requireAuth } from "@/lib/auth"
import UnifiedSidebar from "@/components/unified-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

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
      <div className="flex h-screen overflow-hidden w-full">
        <UnifiedSidebar />
        <SidebarInset className={cn("bg-background transition-all duration-300 ease-in-out", isMobile && "w-full")}>
          <main className="h-full overflow-auto">
            {isFullBleed ? children : <div className="container mx-auto p-4 md:p-6">{children}</div>}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
