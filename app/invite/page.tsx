"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, Users } from "lucide-react"
import AuthShell from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/errors"
import { makeJoinedTeamActive } from "@/lib/joined-team"
import { clearPendingInvite, sameEmail, savePendingInvite } from "@/lib/pending-invite"
import {
  acceptTeamInvite,
  getUserDataFromCookie,
  isAuthenticated,
  logout,
  previewTeamInvite,
  type TeamInvitePreview,
} from "@/services/api"

/**
 * Where the invitation email's link lands. Says who invited you to what, then
 * sends you the right way: sign up with the invited address, sign in, or —
 * already signed in as that address — join on the spot.
 *
 * The code is saved locally before leaving for sign-up, so after verifying
 * the email and signing in, the dashboard can still offer to join with it.
 */
function InviteInner() {
  const params = useSearchParams()
  const code = (params.get("code") || "").trim()

  const [preview, setPreview] = useState<TeamInvitePreview | null>(null)
  const [error, setError] = useState<string | null>(code ? null : "This link has no invitation code in it.")
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    // The cookie marks a session; signup() leaves a localStorage copy behind
    // without one, which must not read as "signed in".
    if (!isAuthenticated()) return
    const email = getUserDataFromCookie()?.email
    setSignedInEmail(typeof email === "string" && email ? email : null)
  }, [])

  useEffect(() => {
    if (!code || ran.current) return
    ran.current = true
    previewTeamInvite(code)
      .then((p) => {
        setPreview(p)
        savePendingInvite({ code, id: p.id, email: p.email, teamName: p.teamName, hasAccount: p.hasAccount })
      })
      .catch((err) => {
        clearPendingInvite()
        setError(getErrorMessage(err) || "This invitation is not valid.")
      })
  }, [code])

  const join = async () => {
    setJoining(true)
    setError(null)
    try {
      const joined = await acceptTeamInvite(code)
      clearPendingInvite()
      try {
        await makeJoinedTeamActive(joined.accountId)
      } catch {
        // Joined either way; the dashboard's number switcher lists the team.
      }
      window.location.assign("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err) || "Couldn't join the team.")
      setJoining(false)
    }
  }

  const signOutAndContinue = async () => {
    setSigningOut(true)
    await logout()
    setSignedInEmail(null)
    setSigningOut(false)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Ask whoever invited you to send a new invitation from Settings → Team.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href={signedInEmail ? "/dashboard" : "/login"}>
            {signedInEmail ? "Go to dashboard" : "Go to sign in"}
          </Link>
        </Button>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking your invitation…</p>
      </div>
    )
  }

  const team = preview.teamName ?? "a team"
  const role = preview.role === "admin" ? "an admin" : "an agent"
  const rightUser = sameEmail(signedInEmail, preview.email)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-medium text-foreground">
            {preview.inviterName ? `${preview.inviterName} invited you to ${team}` : `You're invited to ${team}`}
          </p>
          <p className="text-muted-foreground">
            Join as {role}, for <span className="font-medium text-foreground break-all">{preview.email}</span>.
          </p>
        </div>
      </div>

      {signedInEmail && rightUser ? (
        <Button className="h-11 w-full text-[15px]" onClick={join} disabled={joining}>
          {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Join team
        </Button>
      ) : signedInEmail ? (
        // Accepting would fail on the address match, with a message that can't
        // say why — so say it here, before they try.
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in as <span className="font-medium text-foreground break-all">{signedInEmail}</span>,
            but this invitation is for{" "}
            <span className="font-medium text-foreground break-all">{preview.email}</span>. Sign out and continue
            with that address.
          </p>
          <Button className="h-11 w-full text-[15px]" onClick={signOutAndContinue} disabled={signingOut}>
            {signingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign out and continue
          </Button>
        </div>
      ) : preview.hasAccount ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Sign in with this address, then choose Join team.</p>
          <Button asChild className="h-11 w-full text-[15px]">
            <Link href="/login?invite=1">Sign in to join</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have an account yet. Create one with this address — it takes a minute — then choose
            Join team.
          </p>
          <Button asChild className="h-11 w-full text-[15px]">
            <Link href="/login?invite=1&mode=signup">Create account</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export default function InvitePage() {
  return (
    <AuthShell title="Join your team" subtitle="You've been invited to a shared WhatsApp inbox.">
      <Suspense fallback={<div className="h-40" />}>
        <InviteInner />
      </Suspense>
    </AuthShell>
  )
}
