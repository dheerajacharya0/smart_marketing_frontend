"use client"

import { Suspense, useState } from "react"
import AuthShell from "@/components/auth/auth-shell"
import LoginForm from "@/components/login-form"
import SignupForm from "@/components/signup-form"
import { SessionExpiredNotice } from "@/components/auth/session-expired-notice"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login")

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

      {tab === "login" ? <LoginForm /> : <SignupForm onSwitchToLogin={() => setTab("login")} />}
    </AuthShell>
  )
}
