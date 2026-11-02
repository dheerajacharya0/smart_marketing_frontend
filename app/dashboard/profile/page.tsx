"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { getUserDataFromCookie, type AuthUser } from "@/services/api"

/**
 * Profile.
 *
 * This page previously rendered a hardcoded "John Doe / john@example.com /
 * Super Admin" to every signed-in user, a "Company: Acme Inc" field, and a
 * **Subscription Details card with a fake saved card ("Visa ending in 4242"),
 * a Premium plan, a billing address and a next-billing date** — the same
 * fabricated billing content that was already deleted once with the mock
 * `/dashboard/subscription` page. The product now bills flat Starter/Growth/Pro
 * plans (see /dashboard/settings) with Meta billed direct for messages; the
 * old wallet balance card was removed outright (not demoted to "legacy") —
 * every balance on it was test money from the pre-launch period, never real,
 * so there was nothing worth preserving as a read-only record.
 *
 * `AuthUser` also has no `role` field (see its docstring in services/api.ts), so
 * the "Super Admin" badge was reading `undefined` and rendering a constant.
 *
 * Everything shown now comes from the real session. The edit/password/
 * notification forms were removed rather than left inert: there is no
 * profile-update or change-password endpoint in `services/api.ts`, so their
 * Save buttons never did anything.
 */
export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mounted, setMounted] = useState(false)

  // The cookie is client-only; read after mount so the first render matches SSR.
  useEffect(() => {
    setUser(getUserDataFromCookie())
    setMounted(true)
  }, [])

  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details." />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Signed in as</CardTitle>
            <CardDescription>From your current session</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {!mounted ? (
              <>
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : (
              <>
                <Avatar className="h-24 w-24 border-4 border-primary/10">
                  <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  {user?.name && <h3 className="text-xl font-semibold">{user.name}</h3>}
                  <p className="break-all text-sm text-muted-foreground">
                    {user?.email ?? "Not signed in"}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account security</CardTitle>
            <CardDescription>Changing your password</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <EmptyState
              icon={Lock}
              title="Change your password by email"
              description="Editing your profile in-app isn't wired up yet. To change your password, use the reset link. It emails you a secure one-time link."
              action={
                <Button asChild variant="outline">
                  <Link href="/forgot-password">Send a reset link</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
