"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarProvider,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import {
  BarChart,
  Bell,
  Briefcase,
  CreditCard,
  FileText,
  Home,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Settings,
  User,
  Users,
  ChevronRight,
  Menu,
} from "lucide-react"

export default function UnifiedSidebar() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [notifications, setNotifications] = useState(3)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`)
  }

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      {/* Mobile menu button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      )}

      <Sidebar
        className={cn(
          "sidebar-gradient",
          isMobile && "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out",
          isMobile && !isMenuOpen && "-translate-x-full",
        )}
      >
        <SidebarHeader className="border-b border-sidebar-border/50 pb-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-sidebar-primary/20 avatar-glow">
                  <AvatarImage src="/placeholder.svg?height=40&width=40" alt="Admin" />
                  <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary">AD</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">Super Admin</p>
                  <p className="text-xs text-sidebar-muted-foreground">admin@example.com</p>
                </div>
              </div>
              <SidebarTrigger className="text-sidebar-muted-foreground hover:text-sidebar-foreground" />
            </div>

            <div className="bg-sidebar-accent/30 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-sidebar-muted-foreground">Current Plan</div>
                <Badge
                  variant="outline"
                  className="bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20 text-xs"
                >
                  Premium
                </Badge>
              </div>
              <div className="mt-2 text-xs text-sidebar-muted-foreground">
                <div className="flex justify-between items-center mb-1">
                  <span>API Usage</span>
                  <span className="font-medium">65%</span>
                </div>
                <div className="w-full h-1.5 bg-sidebar-muted rounded-full overflow-hidden">
                  <div className="h-full bg-sidebar-primary rounded-full" style={{ width: "65%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-2">
          <ScrollArea className="h-[calc(100vh-280px)] pr-2 custom-scrollbar">
            <SidebarGroupLabel className="px-2 py-1.5 text-xs font-medium text-sidebar-muted-foreground">
              MAIN NAVIGATION
            </SidebarGroupLabel>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard") && pathname === "/dashboard"}
                  className={cn(
                    "sidebar-item rounded-md mb-1 h-9",
                    isActive("/dashboard") && pathname === "/dashboard" && "active",
                  )}
                >
                  <Link href="/dashboard" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Home className="h-4 w-4 mr-3" />
                      <span>Dashboard</span>
                    </div>
                    {isActive("/dashboard") && pathname === "/dashboard" && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/users")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/users") && "active")}
                >
                  <Link href="/dashboard/users" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-3" />
                      <span>Users</span>
                    </div>
                    {isActive("/dashboard/users") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/whatsapp")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/whatsapp") && "active")}
                >
                  <Link href="/dashboard/whatsapp" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-3" />
                      <span>WhatsApp Business</span>
                    </div>
                    {isActive("/dashboard/whatsapp") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/business")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/business") && "active")}
                >
                  <Link href="/dashboard/business" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Briefcase className="h-4 w-4 mr-3" />
                      <span>Business Integration</span>
                    </div>
                    {isActive("/dashboard/business") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <div className="section-divider my-3"></div>

            <SidebarGroupLabel className="px-2 py-1.5 text-xs font-medium text-sidebar-muted-foreground">
              ANALYTICS & REPORTS
            </SidebarGroupLabel>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/api-usage")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/api-usage") && "active")}
                >
                  <Link href="/dashboard/api-usage" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <BarChart className="h-4 w-4 mr-3" />
                      <span>API Usage</span>
                    </div>
                    {isActive("/dashboard/api-usage") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/notifications")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/notifications") && "active")}
                >
                  <Link href="/dashboard/notifications" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Bell className="h-4 w-4 mr-3" />
                      <span>Notifications</span>
                    </div>
                    {notifications > 0 && (
                      <Badge className="bg-sidebar-primary text-sidebar-primary-foreground h-5 min-w-5 flex items-center justify-center rounded-full text-xs">
                        {notifications}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <div className="section-divider my-3"></div>

            <SidebarGroupLabel className="px-2 py-1.5 text-xs font-medium text-sidebar-muted-foreground">
              HELP & RESOURCES
            </SidebarGroupLabel>

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/docs")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/docs") && "active")}
                >
                  <Link href="/dashboard/docs" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-3" />
                      <span>Documentation</span>
                    </div>
                    {isActive("/dashboard/docs") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/support")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/support") && "active")}
                >
                  <Link href="/dashboard/support" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <LifeBuoy className="h-4 w-4 mr-3" />
                      <span>Support</span>
                    </div>
                    {isActive("/dashboard/support") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/subscription")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/subscription") && "active")}
                >
                  <Link href="/dashboard/subscription" className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-3" />
                      <span>Subscription</span>
                    </div>
                    {isActive("/dashboard/subscription") && (
                      <ChevronRight className="h-4 w-4 text-sidebar-muted-foreground/50" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/50 mt-auto">
          <div className="p-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/profile")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/profile") && "active")}
                >
                  <Link href="/dashboard/profile" className="flex items-center">
                    <User className="h-4 w-4 mr-3" />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/dashboard/settings")}
                  className={cn("sidebar-item rounded-md mb-1 h-9", isActive("/dashboard/settings") && "active")}
                >
                  <Link href="/dashboard/settings" className="flex items-center">
                    <Settings className="h-4 w-4 mr-3" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="sidebar-item rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-9"
                >
                  <Link href="/login" className="flex items-center">
                    <LogOut className="h-4 w-4 mr-3" />
                    <span>Logout</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}
