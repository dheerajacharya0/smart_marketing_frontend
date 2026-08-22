"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowRight, Facebook, Loader2 } from "lucide-react"
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">New WhatsApp Business Integration</h2>
        <p className="text-muted-foreground mt-2">
          Connect your business to WhatsApp to start messaging with your customers.
        </p>
      </div>
      <FacebookCodeHandlerWrapper onConnectionSuccess={handleFacebookConnectionSuccess} />
      <Card>
        <CardHeader>
          <CardTitle>Connect Facebook</CardTitle>
          <CardDescription>
            Pick which linked Facebook Business account this WhatsApp integration belongs to, or connect a new one.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Facebook Authentication</h3>

              {isLoading ? (
                <div className="flex items-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin h-4 w-4 mr-2" /> Checking linked accounts...
                </div>
              ) : accountsLoadError ? (
                // Not "No Facebook account linked yet." — that reads as a
                // prompt to link one again, and linking a second time is not
                // what a failed read calls for.
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{accountsLoadError}</p>
                  <Button variant="outline" size="sm" onClick={() => refetchAccounts()}>
                    Try again
                  </Button>
                </div>
              ) : facebookAccounts.length > 0 ? (
                <RadioGroup value={selectedAccountId ?? ""} onValueChange={setSelectedAccountId}>
                  {facebookAccounts.map((account) => (
                    <div key={account.id} className="flex items-center space-x-3 p-3 border rounded-md">
                      <RadioGroupItem value={account.id} id={account.id} />
                      <Label htmlFor={account.id} className="flex-1">
                        <div className="font-medium">{account.name || account.email || account.id}</div>
                        <div className="text-xs text-muted-foreground">ID: {account.id}</div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-sm text-muted-foreground">No Facebook account linked yet.</p>
              )}

              <Button
                type="button"
                variant="outline"
                // Facebook's own blue, but read from the theme token so it
                // stays in tune with the active palette.
                className="flex items-center gap-2 border-transparent bg-facebook text-white hover:bg-facebook/90 hover:text-white"
                onClick={handleFacebookLogin}
                disabled={!facebookLoginUrl}
              >
                <Facebook className="h-5 w-5" />
                {facebookAccounts.length > 0 ? "Connect a different Facebook account" : "Connect with Facebook"}
              </Button>
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="ml-auto" disabled={!selectedAccountId || isSubmitting}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
