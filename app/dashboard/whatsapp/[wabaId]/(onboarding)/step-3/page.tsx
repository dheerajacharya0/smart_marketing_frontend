"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Copy, Loader2, ChevronDown, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState } from "react"
import { subscribeWhatsappWaba } from "@/services/api"
import { toast } from "react-hot-toast"
import React from "react"

export default function SubscribePage({ params }: { params: Promise<{ wabaId: string }> }) {
  return (
    <React.Suspense fallback={null}>
      <SubscribeContent params={params} />
    </React.Suspense>
  )
}

function SubscribeContent({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const wabaId = searchParams.get("wabaId") || ""
  const phoneNumberId = searchParams.get("phoneNumberId") || ""
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value)
    toast.success("Copied to clipboard")
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    try {
      await subscribeWhatsappWaba({ accountId: unwrappedParams.wabaId, wabaId })
      toast.success("Subscribed to webhook events")
      setIsSubscribed(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to subscribe to webhooks")
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleContinue = () => {
    const query = new URLSearchParams({ wabaId, phoneNumberId })
    router.push(`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-4?${query.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Activate Your Number</h2>
        <p className="text-muted-foreground">One last step so we can receive your customers' messages and replies.</p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex justify-center p-2">
            <Button onClick={handleSubscribe} disabled={isSubscribing || isSubscribed} size="lg" className="w-full sm:w-auto">
              {isSubscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating...
                </>
              ) : isSubscribed ? (
                "Activated"
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" /> Activate
                </>
              )}
            </Button>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto">
              Advanced details <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="waba-id">WhatsApp Business Account ID (WABA ID)</Label>
                <div className="flex">
                  <Input id="waba-id" value={wabaId} readOnly className="flex-1 bg-muted" />
                  <Button variant="outline" size="icon" className="ml-2" onClick={() => handleCopy(wabaId)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-id">Phone Number ID</Label>
                <div className="flex">
                  <Input id="phone-id" value={phoneNumberId} readOnly className="flex-1 bg-muted" />
                  <Button variant="outline" size="icon" className="ml-2" onClick={() => handleCopy(phoneNumberId)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={!isSubscribed} onClick={handleContinue}>
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
