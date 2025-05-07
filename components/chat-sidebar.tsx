"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Plus, LogOut, Settings } from "lucide-react"

// Mock data for chats
const MOCK_CHATS = [
  { id: "1", name: "Business Support", avatar: "/placeholder.svg?height=40&width=40", lastSeen: "Just now", unread: 2 },
  {
    id: "2",
    name: "Order Updates",
    avatar: "/placeholder.svg?height=40&width=40",
    lastSeen: "5 minutes ago",
    unread: 0,
  },
  { id: "3", name: "Promotions", avatar: "/placeholder.svg?height=40&width=40", lastSeen: "Yesterday", unread: 1 },
]

export function ChatSidebar() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [chats, setChats] = useState(MOCK_CHATS)

  const filteredChats = chats.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="w-80 border-r bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Avatar>
            <AvatarImage src="/placeholder.svg?height=40&width=40" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">User</h2>
          </div>
        </div>
        <div className="flex items-center space-x-1">
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

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className={`flex items-center space-x-4 p-3 rounded-md hover:bg-gray-100 cursor-pointer relative ${
                  pathname === `/chat/${chat.id}` ? "bg-gray-100" : ""
                }`}
              >
                <Avatar>
                  <AvatarImage src={chat.avatar || "/placeholder.svg"} alt={chat.name} />
                  <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium truncate">{chat.name}</h3>
                    <span className="text-xs text-gray-500">{chat.lastSeen}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">Click to view chat</p>
                </div>
                {chat.unread > 0 && (
                  <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {chat.unread}
                  </div>
                )}
              </Link>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">No chats found</div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/chat/new">
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Link>
        </Button>
      </div>
    </div>
  )
}
