"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { useAccountRole } from "@/hooks/use-account-role"
import { routeAccess, roleAllows } from "@/lib/access"

/**
 * Stands in for a page the signed-in user's role can't use. The sidebar
 * already hides these, but a bookmark, an old link or a typed URL still
 * lands here — and the page itself would render, fire requests that all
 * answer 403, and fill with error states that read as the product being
 * broken rather than as "not yours".
 *
 * Renders the page until the role is known: the backend is the real gate, and
 * an owner (the usual case) shouldn't wait on a role check to see anything.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ""
  const { role } = useAccountRole()
  const level = routeAccess(pathname)

  if (!role || roleAllows(role, level)) return <>{children}</>

  return (
    <EmptyState
      icon={Lock}
      title={level === "owner" ? "Only the account owner can open this" : "This page is for the account's owner and admins"}
      description={`You're on this account as ${role === "agent" ? "an agent" : "an admin"}. Ask the owner if you need access to it.`}
      action={
        <Button asChild>
          <Link href="/dashboard">Back to the dashboard</Link>
        </Button>
      }
      className="py-16"
    />
  )
}
