"use client"

import Link from "next/link"
import { ArrowLeft, Bell, CreditCard, Lock, Rocket, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { InboxNotificationSettings } from "@/components/inbox-notification-settings"

/**
 * Settings.
 *
 * The tabbed version of this page was almost entirely non-functional: every
 * control was local `useState` with no backend behind it, and several actively
 * misinformed.
 *
 * - **Two-factor authentication** was a toggle that, when flipped, displayed
 *   "Two-factor authentication is enabled." There is no 2FA in this product.
 *   A user could reasonably have believed their account was protected when it
 *   was not — a false security assurance, and the reason this rewrite happened
 *   rather than a restyle.
 * - **API Settings** exposed a fabricated `sk_live_***` key with invented
 *   created/last-used dates, plus a hardcoded webhook URL and `whsec_***`
 *   secret. There is no customer-facing API or API-key concept here.
 * - **Profile** duplicated /dashboard/profile with different fake values
 *   ("Super Admin", "admin@example.com", a job title, phone and bio).
 * - **Session Management** showed an invented session ("Started: Today at
 *   10:23 AM · Chrome on Windows") and a "Sign Out All Other Sessions" button
 *   that did nothing.
 * - **Notification preferences** toggled state that was never persisted or read.
 *
 * Team management is the one real thing here, so it leads. The rest states
 * plainly that it isn't built, and routes to the flows that do work.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <PageHeader title="Settings" description="Manage your account and team." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team
          </CardTitle>
          <CardDescription>
            Invite teammates to this account and control what they can do.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/settings/team">Manage team</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Plan & billing
          </CardTitle>
          <CardDescription>
            Starter, Growth or Pro — compare plans and manage your subscription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/plan">View plans</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Guided Launch
          </CardTitle>
          <CardDescription>
            ₹999 one-time, 15-Day onboarding package — one per business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/guided-launch">View Guided Launch</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your name, email, and balance</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard/profile">Open profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Password and account access</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Password changes go through an emailed reset link. Two-factor authentication and
              session management aren&apos;t available yet.
            </p>
            <Button asChild variant="outline">
              <Link href="/forgot-password">Send a reset link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>How you hear about incoming messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <InboxNotificationSettings />

          {/* Narrowed rather than deleted: the message preferences above are
              real now, but alert *delivery* genuinely isn't built, and saying
              so beats an empty section people keep checking. */}
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            Quality and delivery alerts are separate, always on, and appear in{" "}
            <Link href="/dashboard/notifications" className="underline underline-offset-4">
              Notifications
            </Link>
            . Emailing those alerts is still being built.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
