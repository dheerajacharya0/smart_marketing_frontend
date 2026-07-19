"use client"

import Link from "next/link"
import { ArrowRight, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { getUserDataFromCookie, getFacebookBusinessManagers, setWhatsappBusinessDetails, syncBusiness } from "@/services/api"
import React from "react"
import { useRouter } from "next/navigation"

export default function BusinessSelectionPage({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const [businesses, setBusinesses] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const router = useRouter()
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  // Fetch user only once
  useEffect(() => {
    const userData = getUserDataFromCookie()
    setUser(userData)
  }, [])

  // Sync business, then fetch the synced Facebook business list
  useEffect(() => {
    const fetchBusinesses = async () => {
      setIsLoading(true)
      setError(null)
      if (user?.id && unwrappedParams?.wabaId) {
        try {
          await syncBusiness(unwrappedParams.wabaId)
          const res = await getFacebookBusinessManagers(user.id, unwrappedParams.wabaId)
          setBusinesses(Array.isArray(res) ? res : [])
        } catch (err) {
          setError("Failed to load business details.")
        }
      }
      setIsLoading(false)
    }
    if (!hasFetched.current && user?.id && unwrappedParams?.wabaId) {
      hasFetched.current = true
      fetchBusinesses()
    }
  }, [user, unwrappedParams?.wabaId])

  // Memoize selected business
  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId),
    [businesses, selectedBusinessId]
  )

  // Handle continue
  const handleContinue = useCallback(async () => {
    if (!user?.id || !unwrappedParams?.wabaId || !selectedBusiness) return
    setIsSubmitting(true)
    setError(null)
    try {
      await setWhatsappBusinessDetails({
        accountId: unwrappedParams.wabaId,
        accountDetails: selectedBusiness,
      })
      router.push(`/dashboard/whatsapp/${unwrappedParams?.wabaId}/step-2`)
    } catch (err) {
      setError("Failed to save WhatsApp Business details.")
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
            ) : (
              <RadioGroup value={selectedBusinessId ?? ""} onValueChange={setSelectedBusinessId}>
                {businesses.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No businesses found.</div>
                ) : (
                  businesses.map((business: any) => (
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
            {error && <div className="text-red-500 text-sm">{error}</div>}
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
