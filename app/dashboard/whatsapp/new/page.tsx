"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Facebook, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  OnboardingFrame,
  OptionCard,
  OptionListSkeleton,
  Pill,
  SectionTitle,
  StatusNote,
  StepCard,
  StepFooter,
  StepHeader,
} from "@/components/onboarding/onboarding-ui"
import { getFacebookLoginUrl, getUserDataFromCookie, getFacebookAccounts, type FacebookAccount } from "@/services/api"
import FacebookCodeHandlerWrapper from "@/components/facebook-code-handler-wrapper"
import { withOAuthState } from "@/lib/oauth-state"
import { useQuery } from "@tanstack/react-query"
import { getErrorMessage } from "@/lib/errors"

export default function NewWhatsAppIntegrationPage() {
  const router = useRouter()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    setUser(getUserDataFromCookie())
  }, [])

  const {
    data: accountsData,
    isLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ["facebook-accounts"],
    queryFn: async () => (await getFacebookAccounts()).filter((a) => a.type === "facebook"),
    enabled: Boolean(user?.id),
  })
  const facebookAccounts: FacebookAccount[] = useMemo(() => accountsData ?? [], [accountsData])

  // One linked account is the common case; don't make anyone click the only
  // option before Continue works.
  useEffect(() => {
    if (!selectedAccountId && facebookAccounts.length === 1) setSelectedAccountId(facebookAccounts[0].id)
  }, [facebookAccounts, selectedAccountId])
  const accountsLoadError = accountsError
    ? getErrorMessage(accountsError, "Couldn't load your linked Facebook accounts")
    : null

  // Always fetched, not gated on "already connected": someone can link more
  // than one Facebook account.
  const { data: facebookLoginUrl = "" } = useQuery({
    queryKey: ["facebook-login-url"],
    queryFn: getFacebookLoginUrl,
  })

  const handleFacebookLogin = () => {
    if (!facebookLoginUrl) return
    try {
      // Our own CSRF nonce replaces the backend's placeholder `state`; the
      // callback handler rejects a code that comes back without it.
      window.location.href = withOAuthState(facebookLoginUrl)
    } catch (error) {
      console.error("Failed to start Facebook login:", error)
    }
  }

  const handleFacebookConnectionSuccess = useCallback(async () => {
    if (!user?.id) return
    // Selects whichever account is new, so the one just linked is the one
    // pre-selected. The comparison needs the list from before the refetch,
    // which is why this reads `facebookAccounts` rather than only the result.
    const previousIds = new Set(facebookAccounts.map((a) => a.id))
    const { data: updated = [] } = await refetchAccounts()
    const newlyAdded = updated.find((a) => !previousIds.has(a.id))
    setSelectedAccountId(newlyAdded?.id ?? updated[updated.length - 1]?.id ?? null)
  }, [user, facebookAccounts, refetchAccounts])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!selectedAccountId) {
      setSubmitError("Connect and select a Facebook account to continue.")
      return
    }
    setIsSubmitting(true)
    try {
      router.push(`/dashboard/whatsapp/${selectedAccountId}/step-1`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasAccounts = facebookAccounts.length > 0

  return (
    <OnboardingFrame>
      <FacebookCodeHandlerWrapper onConnectionSuccess={handleFacebookConnectionSuccess} />
      <form onSubmit={handleSubmit} className="space-y-6">
        <StepHeader
          step={0}
          icon={<Facebook className="h-6 w-6" />}
          title="Link your Facebook account"
          description="Your WhatsApp Business account lives in Meta's Business Manager, so we connect through Facebook first. You'll pick the business on the next step."
        />

        <StepCard>
          <SectionTitle
            title={hasAccounts ? "Choose a linked Facebook account" : "Connect Facebook"}
            description={
              hasAccounts
                ? "Pick the Facebook login that manages this business, or link a different one."
                : "Sign in with the Facebook account that manages your business."
            }
          />

          {isLoading ? (
            <OptionListSkeleton label="Checking linked accounts…" rows={1} />
          ) : accountsLoadError ? (
            // Not "No Facebook account linked yet." — that reads as a
            // prompt to link one again, and linking a second time is not
            // what a failed read calls for.
            <StatusNote
              tone="error"
              title="We couldn't load your linked accounts"
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => refetchAccounts()}>
                  Try again
                </Button>
              }
            >
              {accountsLoadError}
            </StatusNote>
          ) : hasAccounts ? (
            <div role="radiogroup" aria-label="Linked Facebook accounts" className="grid gap-3">
              {facebookAccounts.map((account) => (
                <OptionCard
                  key={account.id}
                  selected={selectedAccountId === account.id}
                  onSelect={() => setSelectedAccountId(account.id)}
                  icon={<Facebook className="h-5 w-5" />}
                  title={account.name || account.email || "Facebook account"}
                  subtitle={account.email && account.name ? account.email : undefined}
                  badge={account.needsReauth ? <Pill tone="warning">Needs reconnecting</Pill> : null}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-facebook/10 text-facebook">
                <Facebook className="h-6 w-6" />
              </span>
              <p className="font-medium">No Facebook account linked yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                You&apos;ll be sent to Facebook to sign in, then brought straight back here.
              </p>
            </div>
          )}

          <div className={cn("mt-5 flex flex-col gap-3 sm:flex-row sm:items-center", hasAccounts && "border-t pt-5")}>
            <Button
              type="button"
              // `secondary`: the default variant paints the theme gradient
              // over any background, and this is Facebook's button.
              variant={hasAccounts ? "outline" : "secondary"}
              className={cn(
                "w-full sm:w-auto",
                !hasAccounts && "bg-facebook text-white shadow-xs hover:bg-facebook/90 hover:shadow-sm"
              )}
              onClick={handleFacebookLogin}
              disabled={!facebookLoginUrl}
            >
              <Facebook className="mr-2 h-4 w-4" />
              {hasAccounts ? "Link a different Facebook account" : "Continue with Facebook"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Secure sign-in through Meta. We never see your password.
            </p>
          </div>
        </StepCard>

        {submitError ? <StatusNote tone="error">{submitError}</StatusNote> : null}

        <StepFooter backHref="/dashboard/whatsapp">
          <Button type="submit" className="w-full sm:w-auto" disabled={!selectedAccountId || isSubmitting}>
            Continue to business
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </StepFooter>
      </form>
    </OnboardingFrame>
  )
}
