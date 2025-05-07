"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart,
  Bell,
  Briefcase,
  CreditCard,
  FileText,
  Home,
  LifeBuoy,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

export const dashboardNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: Users,
  },
  {
    title: "WhatsApp Business",
    href: "/dashboard/whatsapp",
    icon: MessageSquare,
  },
  {
    title: "Business Integration",
    href: "/dashboard/business",
    icon: Briefcase,
  },
  {
    title: "API Usage",
    href: "/dashboard/api-usage",
    icon: BarChart,
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
  },
  {
    title: "Documentation",
    href: "/dashboard/docs",
    icon: FileText,
  },
  {
    title: "Support",
    href: "/dashboard/support",
    icon: LifeBuoy,
  },
  {
    title: "Subscription",
    href: "/dashboard/subscription",
    icon: CreditCard,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

interface DashboardNavProps {
  className?: string
}

export function DashboardNav({ className }: DashboardNavProps) {
  const pathname = usePathname()

  return (
    <nav className={cn("grid items-start gap-2", className)}>
      {dashboardNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.disabled ? "#" : item.href}
          className={cn(
            "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
            pathname === item.href ? "bg-accent text-accent-foreground" : "transparent",
            item.disabled && "cursor-not-allowed opacity-80",
          )}
        >
          <item.icon className="mr-2 h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      ))}
    </nav>
  )
}
