"use client"

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { getUserDataFromCookie } from "@/services/api"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

/**
 * Revenue ledger is mid-build — hidden from customers, visible only to
 * NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS until development finishes and pricing is
 * decided (see lib/platform-admin.ts). Starts in the "not admin" state so a
 * customer never sees a flash of real content before the cookie check runs.
 */
export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    setAdmin(isPlatformAdminEmail(getUserDataFromCookie()?.email))
  }, [])

  if (!admin) {
    return (
      <EmptyState
        icon={Lock}
        title="Coming soon"
        description="Revenue ledger is still in development and isn't available yet."
      />
    )
  }

  return <>{children}</>
}
