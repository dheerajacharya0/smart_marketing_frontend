"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Plus, LogOut, Settings, Users, Home, MessageCircle } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar"

interface AppSidebarProps {
  variant: "admin" | "user"
  items: Array<{
    id: string
    name: string
    avatar?: string
    lastSeen?: string
    unread?: number
    href: string
  }>
}

export function AppSidebar({ variant, items }: AppSidebarProps) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Avatar>
                <AvatarImage src="/placeholder.svg?height=40&width=40" alt="Profile" />
                <AvatarFallback>{variant === "admin" ? "AD" : "U"}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">{variant === "admin" ? "Super Admin" : "User"}</h2>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" asChild>
                <Link href={variant === "admin" ? "/dashboard" : "/chat"}>
                  {variant === "admin" ? <Home className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                  <span className="sr-only">{variant === "admin" ? "Home" : "Chat"}</span>
                </Link>
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/login">
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Logout</span>
                </Link>
              </Button>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={variant === "admin" ? "Search users" : "Search chats"}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <ScrollArea className="h-[calc(100vh-180px)]">
            <SidebarMenu>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={pathname.includes(item.href)}>
                      <Link href={item.href} className="flex items-center space-x-4 w-full">
                        <Avatar>
                          <AvatarImage src={item.avatar || "/placeholder.svg"} alt={item.name} />
                          <AvatarFallback>{item.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium truncate">{item.name}</h3>
                            {item.lastSeen && <span className="text-xs text-gray-500">{item.lastSeen}</span>}
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {variant === "admin" ? "Click to manage integration" : "Click to view chat"}
                          </p>
                        </div>
                        {item.unread && item.unread > 0 && (
                          <div className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            {item.unread}
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">No {variant === "admin" ? "users" : "chats"} found</div>
              )}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>

        <SidebarFooter>
          <div className="p-4">
            <Button variant="outline" className="w-full" asChild>
              <Link href={variant === "admin" ? "/dashboard/users" : "/chat/new"}>
                {variant === "admin" ? (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Manage All Users
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    New Chat
                  </>
                )}
              </Link>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  )
}
