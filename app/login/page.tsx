"use client"

import { Suspense, useEffect, useState } from "react"
import { Users } from "lucide-react"
import AuthShell from "@/components/auth/auth-shell"
import LoginForm from "@/components/login-form"
import SignupForm from "@/components/signup-form"
import { SessionExpiredNotice } from "@/components/auth/session-expired-notice"
import { readPendingInvite, type PendingInvite } from "@/lib/pending-invite"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login")
  // Arriving from an invitation (/invite → "Create account" / "Sign in to
  // join"): open the matching tab with the invited address filled in, since
  // any other address can't accept it. Read after mount — storage and the
  // query string aren't there during the server render.
  const [invite, setInvite] = useState<PendingInvite | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get("invite")) return
    const pending = readPendingInvite()
    if (!pending) return
    setInvite(pending)
    setTab(params.get("mode") === "signup" ? "signup" : "login")
  }, [])

  return (
    <AuthShell
      title={tab === "login" ? "Welcome back" : "Create your account"}
      subtitle={
        tab === "login"
          ? "Sign in to manage campaigns, conversations, and your team."
          : "Start reaching customers on WhatsApp in minutes — no credit card required."
      }
    >
      <Suspense fallback={null}>
        <SessionExpiredNotice />
      </Suspense>

      {invite ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <span>
            {tab === "signup" ? "Create your account" : "Sign in"} with{" "}
            <span className="font-medium break-all">{invite.email}</span> to join{" "}
            {invite.teamName ? <span className="font-medium">{invite.teamName}</span> : "the team"}.
          </span>
        </div>
      ) : null}

      {/* Segmented control */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-all",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "login" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {/* Keyed on the invite so the forms re-mount with its address once it's read. */}
      {tab === "login" ? (
        <LoginForm key={invite?.code ?? "plain"} initialEmail={invite?.email} />
      ) : (
        <SignupForm
          key={invite?.code ?? "plain"}
          initialEmail={invite?.email}
          onSwitchToLogin={() => setTab("login")}
        />
      )}
    </AuthShell>
  )
}
