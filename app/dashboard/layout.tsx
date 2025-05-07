"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import UnifiedSidebar from "@/components/unified-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile)

  // Update sidebar state when screen size changes
  useEffect(() => {
    setIsSidebarOpen(!isMobile)
  }, [isMobile])

  return (
    <SidebarProvider defaultOpen={!isMobile} open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <div className="flex h-screen overflow-hidden w-full">
        <UnifiedSidebar />
        <SidebarInset className={cn("bg-background transition-all duration-300 ease-in-out", isMobile && "w-full")}>
          <main className="h-full overflow-auto">
            <div className="container mx-auto p-4 md:p-6">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
