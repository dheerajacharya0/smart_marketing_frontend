"use client"

import type React from "react"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import AuthShell from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput, PasswordStrength, scorePassword } from "@/components/auth/password-input"
import { resetPassword } from "@/services/api"

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("This reset link is invalid or has expired. Request a new one.")
      return
    }
    if (scorePassword(password) < 2) {
      setError("Please choose a stronger password (8+ characters, mixed case & numbers)")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    setIsLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.push("/login"), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password")
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your password has been updated. Redirecting you to sign in…
        </p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline underline-offset-2">
          Go to sign in now
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          placeholder="Create a new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordStrength password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="h-11 w-full text-[15px]" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-2"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don’t use anywhere else.">
      <Suspense fallback={<div className="h-40" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
