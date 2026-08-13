"use client"

import Link from "next/link"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"

/**
 * Platform-wide user administration — not built.
 *
 * This page used to render five invented users ("John Doe", "Jane Smith", …)
 * with fake statuses and **subscription tiers that no longer exist as a
 * concept** — the product bills per conversation through a prepaid wallet, not
 * per plan. Anyone landing here would have concluded both that user management
 * worked and that plans were a thing.
 *
 * Team management for a single account *is* real, so point there instead of
 * dead-ending.
 */
export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Platform-wide user administration."
      />

      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Users}
            title="User management isn't built yet"
            description="Administering users across the whole platform is on the roadmap. Inviting teammates to your own account and managing their roles already works today."
            action={
              <Button asChild>
                <Link href="/dashboard/settings/team">Go to team settings</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
