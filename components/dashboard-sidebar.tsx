"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Settings, Users, Home, MessageSquare, BarChart, Bell, Briefcase } from "lucide-react"

// Mock data for Facebook users
const MOCK_USERS = [
  { id: "1", name: "John Doe", avatar: "/placeholder.svg?height=40&width=40", lastSeen: "Just now", unread: 3 },
  { id: "2", name: "Jane Smith", avatar: "/placeholder.svg?height=40&width=40", lastSeen: "5 minutes ago", unread: 0 },
  {
    id: "3",
    name: "Robert Johnson",
    avatar: "/placeholder.svg?height=40&width=40",
    lastSeen: "2 hours ago",
    unread: 1,
  },
  { id: "4", name: "Emily Davis", avatar: "/placeholder.svg?height=40&width=40", lastSeen: "Yesterday", unread: 0 },
  { id: "5", name: "Michael Wilson", avatar: "/placeholder.svg?height=40&width=40", lastSeen: "2 days ago", unread: 0 },
]

export default function DashboardSidebar() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState(MOCK_USERS)
  const [newUserName, setNewUserName] = useState("")
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)

  const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleAddUser = () => {
    if (newUserName.trim()) {
      const newUser = {
        id: (users.length + 1).toString(),
        name: newUserName,
        avatar: "/placeholder.svg?height=40&width=40",
        lastSeen: "Just now",
        unread: 0,
      }
      setUsers([...users, newUser])
      setNewUserName("")
      setIsAddUserDialogOpen(false)
    }
  }

  const handleRemoveUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId))
  }

  return (
    <div className="w-80 border-r bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Avatar>
            <AvatarImage src="/placeholder.svg?height=40&width=40" alt="Admin" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">Super Admin</h2>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <Home className="h-5 w-5" />
              <span className="sr-only">Home</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/settings">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/login">
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Logout</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-b">
        <nav className="space-y-1">
          <Button variant={pathname === "/dashboard" ? "secondary" : "ghost"} className="w-full justify-start" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant={pathname === "/dashboard/users" || pathname.startsWith("/dashboard/user/") ? "secondary" : "ghost"}
            className="w-full justify-start"
            asChild
          >
            <Link href="/dashboard/users">
              <Users className="h-4 w-4 mr-2" />
              Facebook Users
            </Link>
          </Button>
          <Button
            variant={pathname === "/dashboard/waba" || pathname.startsWith("/dashboard/waba/") ? "secondary" : "ghost"}
            className="w-full justify-start"
            asChild
          >
            <Link href="/dashboard/waba">
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp Accounts
            </Link>
          </Button>
          <Button
            variant={
              pathname === "/dashboard/business" || pathname.startsWith("/dashboard/business/") ? "secondary" : "ghost"
            }
            className="w-full justify-start"
            asChild
          >
            <Link href="/dashboard/business">
              <Briefcase className="h-4 w-4 mr-2" />
              Business Integration
            </Link>
          </Button>
          <Button
            variant={pathname === "/dashboard/api-usage" ? "secondary" : "ghost"}
            className="w-full justify-start"
            asChild
          >
            <Link href="/dashboard/api-usage">
              <BarChart className="h-4 w-4 mr-2" />
              API Usage
            </Link>
          </Button>
          <Button
            variant={pathname === "/dashboard/notifications" ? "secondary" : "ghost"}
            className="w-full justify-start"
            asChild
          >
            <Link href="/dashboard/notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Link>
          </Button>
        </nav>
      </div>
    </div>
  )
}
