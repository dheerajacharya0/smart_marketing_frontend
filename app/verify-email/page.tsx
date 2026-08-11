"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react"
import AuthShell from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resendVerification, verifyEmail } from "@/services/api"

type Status = "verifying" | "success" | "error"

function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get("token") || ""

  const [status, setStatus] = useState<Status>(token ? "verifying" : "error")
  const [message, setMessage] = useState(token ? "" : "No verification token found in this link.")
  const [email, setEmail] = useState("")
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle")
  const ran = useRef(false)

  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true
    verifyEmail(token)
      .then((r) => {
        setStatus("success")
        setMessage(r.message)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err instanceof Error ? getErrorMessage(err) : "This verification link is invalid or has expired.")
      })
  }, [token])

  const handleResend = async () => {
    if (!email) return
    setResendState("sending")
    try {
      await resendVerification(email)
      setResendState("sent")
    } catch {
      setResendState("idle")
    }
  }

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
        <Button asChild className="h-11 w-full text-[15px]">
          <Link href="/login">Continue to sign in</Link>
        </Button>
      </div>
    )
  }

  // error — offer resend
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{message}</span>
      </div>

      {resendState === "sent" ? (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <MailCheck className="h-4 w-4" /> A fresh verification email is on its way.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="verify-email">Resend verification to</Label>
            <Input
              id="verify-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={!email || resendState === "sending"}
          >
            {resendState === "sending" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
        </div>
      )}

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-primary hover:underline underline-offset-2"
      >
        Back to sign in
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" subtitle="Confirming your address keeps your account secure.">
      <Suspense fallback={<div className="h-40" />}>
        <VerifyEmailInner />
      </Suspense>
    </AuthShell>
  )
}
