"use client"

import type React from "react"
import { getErrorMessage } from "@/lib/errors"

import { useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput, PasswordStrength, scorePassword } from "@/components/auth/password-input"
import { signup, resendVerification } from "@/services/api"

export default function SignupForm({
  onSwitchToLogin,
  initialEmail,
}: {
  onSwitchToLogin?: () => void
  /** Prefilled from an invitation, which only the invited address can accept. */
  initialEmail?: string
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState(initialEmail ?? "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle")

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name || !email || !password) {
      setError("All fields are required")
      return
    }
    if (scorePassword(password) < 2) {
      setError("Please choose a stronger password (8+ characters, mixed case & numbers)")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await signup(name, email, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? getErrorMessage(err) : "Signup failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setResendState("sending")
    try {
      await resendVerification(email)
      setResendState("sent")
    } catch {
      setResendState("idle")
    }
  }

  // Post-signup: prompt email verification (Feature #1 gap).
  if (done) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Confirm your email</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Click it to
            activate your account.
          </p>
        </div>

        {resendState === "sent" ? (
          <p className="flex items-center justify-center gap-1.5 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> Verification email resent
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={resendState === "sending"}
          >
            {resendState === "sending" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
        )}

        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Priya Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Work email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordStrength password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {mismatch && <p className="text-xs text-destructive">Passwords don’t match</p>}
      </div>

      <Button type="submit" className="h-11 w-full text-[15px]" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  )
}
