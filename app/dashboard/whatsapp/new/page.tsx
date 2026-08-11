"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowRight, Facebook, Loader2 } from "lucide-react"
import { getFacebookLoginUrl, getUserDataFromCookie, getFacebookAccounts } from "@/services/api"
import FacebookCodeHandlerWrapper from "@/components/facebook-code-handler-wrapper"

export default function NewWhatsAppIntegrationPage() {
  const router = useRouter()
  const [facebookAccounts, setFacebookAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [facebookLoginUrl, setFacebookLoginUrl] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)

  const fetchFacebookAccounts = useCallback(async (userId: string) => {
    const accounts = await getFacebookAccounts(userId)
    const facebookOnly = accounts.filter((a) => a.type === "facebook")
    setFacebookAccounts(facebookOnly)
    return facebookOnly
  }, [])

  useEffect(() => {
    const userData = getUserDataFromCookie()
    setUser(userData)

    const init = async () => {
      if (!userData?.id) {
        setIsLoading(false)
        return
      }
      try {
        await fetchFacebookAccounts(userData.id)
      } catch (err) {
        console.error("Failed to load linked Facebook accounts:", err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [fetchFacebookAccounts])

  // Login URL is always fetched (not gated on "already connected") since users can link more than one Facebook account.
  useEffect(() => {
    const fetchLoginUrl = async () => {
      try {
        const url = await getFacebookLoginUrl()
        setFacebookLoginUrl(url)
      } catch (error) {
        console.error("Failed to fetch Facebook login URL:", error)
      }
    }
    fetchLoginUrl()
  }, [])

  const handleFacebookLogin = () => {
    if (facebookLoginUrl) {
      window.location.href = facebookLoginUrl
    }
  }

  const handleFacebookConnectionSuccess = useCallback(async () => {
    if (!user?.id) return
    const previousIds = new Set(facebookAccounts.map((a) => a.id))
    const updated = await fetchFacebookAccounts(user.id)
    const newlyAdded = updated.find((a) => !previousIds.has(a.id))
    setSelectedAccountId(newlyAdded?.id ?? updated[updated.length - 1]?.id ?? null)
  }, [user, facebookAccounts, fetchFacebookAccounts])

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
                className="flex items-center gap-2 bg-[#1877F2] text-white hover:bg-[#0C63D4] hover:text-white"
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
