"use client"

import Link from "next/link"
import { ArrowRight, Building, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { getUserDataFromCookie, getFacebookBusinessManagers, setWhatsappBusinessDetails } from "@/services/api"
import React from "react"
import { useRouter } from "next/navigation"

export default function BusinessManagerPage({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const [businessManagers, setBusinessManagers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const router = useRouter()
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  // Fetch user only once
  useEffect(() => {
    const userData = getUserDataFromCookie()
    setUser(userData)
  }, [])

  // Fetch business managers
  useEffect(() => {
    const fetchBusinessManagers = async () => {
      setIsLoading(true)
      setError(null)
      if (user?.id && unwrappedParams?.wabaId) {
        try {
          const res = await getFacebookBusinessManagers(user.id, unwrappedParams.wabaId)
          setBusinessManagers(res || [])
        } catch (err) {
          setError("Failed to load business managers.")
        }
      }
      setIsLoading(false)
    }
    if (!hasFetched.current && user?.id && unwrappedParams?.wabaId) {
      hasFetched.current = true
      fetchBusinessManagers()
    }
  }, [user, unwrappedParams?.wabaId])

  // Memoize selected manager
  const selectedManager = useMemo(
    () => businessManagers.find(m => m.id === selectedManagerId),
    [businessManagers, selectedManagerId]
  )

  // Handle continue
  const handleContinue = useCallback(async () => {
    if (!user?.id || !unwrappedParams?.wabaId || !selectedManager) return
    setIsSubmitting(true)
    setError(null)
    try {
      await setWhatsappBusinessDetails({
        userId: user.id,
        businessId: unwrappedParams.wabaId,
        accountDetails: selectedManager,
      })
      router.push(`/dashboard/whatsapp/${unwrappedParams?.wabaId}/step-5`)
    } catch (err) {
      setError("Failed to save WhatsApp Business details.")
    } finally {
      setIsSubmitting(false)
    }
  }, [user, unwrappedParams, selectedManager, router])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Select or Create Business Manager</h2>
        <p className="text-muted-foreground">
          Choose an existing Business Manager or create a new one for your WhatsApp Business Account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Manager Selection</CardTitle>
          <CardDescription>
            A Business Manager is required to create and manage your WhatsApp Business Account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Select an existing Business Manager:</h3>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-sm text-muted-foreground">Loading business managers...</span>
              </div>
            ) : (
              <RadioGroup value={selectedManagerId ?? ""} onValueChange={setSelectedManagerId}>
                {businessManagers.length === 0 ? (
                  <div className="text-muted-foreground text-sm">No business managers found.</div>
                ) : (
                  businessManagers.map((manager: any) => (
                    <div key={manager.id} className="flex items-center space-x-3 p-3 border rounded-md">
                      <RadioGroupItem value={manager.id} id={manager.id} />
                      <Label htmlFor={manager.id} className="flex-1">
                        <div className="font-medium">{manager.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {manager.id}</div>
                      </Label>
                      <Building className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </RadioGroup>
            )}
            {error && <div className="text-red-500 text-sm">{error}</div>}
          </div>

          <div className="flex items-center space-x-2 pt-4">
            <div className="h-px flex-1 bg-border"></div>
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Create New Business Manager
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={!selectedManagerId || isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? "Processing..." : <>Continue to WABA Creation <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  )
}
