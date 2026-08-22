"use client"

import { ArrowRight, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useEffect, useState, useCallback, useMemo } from "react"
import { getUserDataFromCookie, getFacebookBusinessManagers, setWhatsappBusinessDetails, syncBusiness } from "@/services/api"
import React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

interface BusinessManager {
  businessId: string
  name?: string
  [key: string]: unknown
}

export default function BusinessSelectionPage({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)

  // Fetch user only once
  useEffect(() => {
    const userData = getUserDataFromCookie()
    setUser(userData)
  }, [])

  // Sync our copy from Meta, then read the synced list — one query, because a
  // list fetched before the sync lands is the stale list this step exists to
  // avoid showing.
  //
  // The `hasFetched` ref that used to guard this is gone: it existed to stop the
  // effect firing twice, which is a thing effects do and queries do not.
  const {
    data,
    isLoading,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ["facebook-business-managers", unwrappedParams?.wabaId],
    queryFn: async () => {
      await syncBusiness(unwrappedParams.wabaId)
      const res = await getFacebookBusinessManagers(unwrappedParams.wabaId)
      return Array.isArray(res) ? res : []
    },
    enabled: Boolean(user?.id && unwrappedParams?.wabaId),
  })
  const businesses: BusinessManager[] = useMemo(() => data ?? [], [data])
  // Kept apart from the save failure below: one means "we couldn't read your
  // businesses", the other "we couldn't record the one you picked", and the
  // second must not be cleared by a background refetch of the first.
  const readError = loadError ? "Failed to load business details." : null
  const [saveError, setSaveError] = useState<string | null>(null)

  // Memoize selected business
  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId),
    [businesses, selectedBusinessId]
  )

  // Handle continue
  const handleContinue = useCallback(async () => {
    if (!user?.id || !unwrappedParams?.wabaId || !selectedBusiness) return
    setIsSubmitting(true)
    setSaveError(null)
    try {
      await setWhatsappBusinessDetails({
        accountId: unwrappedParams.wabaId,
        accountDetails: selectedBusiness,
      })
      router.push(`/dashboard/whatsapp/${unwrappedParams?.wabaId}/step-2`)
    } catch {
      setSaveError("Failed to save WhatsApp Business details.")
    } finally {
      setIsSubmitting(false)
    }
  }, [user, unwrappedParams, selectedBusiness, router])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Select Your Facebook Business</h2>
        <p className="text-muted-foreground">
          Choose the Facebook Business you want to use for your WhatsApp Business Account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Selection</CardTitle>
          <CardDescription>
            This is synced from the Facebook account you connected in the previous step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-sm text-muted-foreground">Syncing business...</span>
              </div>
            ) : readError ? (
              // Not "No businesses found." — that sentence sends someone back
              // to Facebook to create a Business Manager they already have.
              <div className="space-y-2">
                <p className="text-sm text-destructive">{readError}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : (
              <RadioGroup value={selectedBusinessId ?? ""} onValueChange={setSelectedBusinessId}>
                {businesses.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No businesses found.</div>
                ) : (
                  businesses.map((business) => (
                    <div key={business.businessId} className="flex items-center space-x-3 p-3 border rounded-md">
                      <RadioGroupItem value={business.businessId} id={business.businessId} />
                      <Label htmlFor={business.businessId} className="flex-1">
                        <div className="font-medium">{business.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {business.businessId}</div>
                      </Label>
                      <Building className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </RadioGroup>
            )}
            {saveError && <div className="text-destructive text-sm">{saveError}</div>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={!selectedBusinessId || isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? "Processing..." : <>Continue to WhatsApp Account <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  )
}
