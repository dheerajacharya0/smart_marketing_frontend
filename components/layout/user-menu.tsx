"use client"

import Link from "next/link"
import { LifeBuoy, LogOut, Settings, User } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { AuthUser } from "@/services/api"

/**
 * Identity + account actions, collapsed behind one avatar trigger. Used to be
 * four separate sidebar rows (Profile, Settings, Sign out, plus Support up in
 * the Help nav group) — every one of them is "about you", not a workflow, so
 * they're grouped here instead of competing with the nav for space.
 */
export function UserMenu({
  user,
  onSignOut,
  collapsed = false,
}: {
  user: AuthUser | null
  onSignOut: () => void
  collapsed?: boolean
}) {
  const userLabel = user?.name || user?.email || ""
  const userInitials =
    userLabel
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "focus-ring flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent/60",
            collapsed && "justify-center px-0",
          )}
        >
          <Avatar className="h-8 w-8 avatar-glow shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && user && (
            <div className="min-w-0">
              {user.name && <p className="truncate text-xs font-medium text-sidebar-foreground">{user.name}</p>}
              <p className="truncate text-[11px] text-sidebar-muted-foreground">{user.email}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        {user && (
          <>
            <DropdownMenuLabel className="font-normal">
              {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/support">
            <LifeBuoy className="h-4 w-4" />
            Support
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          className="text-destructive focus:bg-destructive-soft focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
