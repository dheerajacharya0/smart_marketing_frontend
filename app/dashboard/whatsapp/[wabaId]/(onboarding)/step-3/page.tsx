"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { getErrorMessage } from "@/lib/errors"
import { ArrowRight, CheckCircle2, Copy, Loader2, ChevronDown, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StepCard, StepFooter, StepHeader } from "@/components/onboarding/onboarding-ui"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Explain } from "@/components/explain"
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
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to subscribe to webhooks")
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
      <StepHeader
        step={2}
        icon={<Zap className="h-6 w-6" />}
        title="Turn on message delivery"
        description="Connects your number to this dashboard so your customers' messages, replies and delivery updates reach you."
      />

      <StepCard>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span
            className={
              isSubscribed
                ? "flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"
                : "flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
            }
          >
            {isSubscribed ? <CheckCircle2 className="h-7 w-7" /> : <Zap className="h-7 w-7" />}
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isSubscribed
              ? "Message delivery is on. Continue to finish your setup."
              : "One click — nothing else to configure."}
          </p>
          <Button onClick={handleSubscribe} disabled={isSubscribing || isSubscribed} size="lg" className="w-full sm:w-auto">
            {isSubscribing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating…
              </>
            ) : isSubscribed ? (
              "Activated"
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" /> Turn on delivery
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 border-t pt-4">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto">
              Advanced details <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="waba-id">
                  WhatsApp Business Account ID (WABA ID)
                  <Explain term="waba" />
                </Label>
                <div className="flex">
                  <Input id="waba-id" value={wabaId} readOnly className="flex-1 bg-muted" />
                  <Button variant="outline" size="icon" className="ml-2" aria-label="Copy WhatsApp Business Account ID" onClick={() => handleCopy(wabaId)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-id">
                  Phone Number ID
                  <Explain term="phone-number-id" />
                </Label>
                <div className="flex">
                  <Input id="phone-id" value={phoneNumberId} readOnly className="flex-1 bg-muted" />
                  <Button variant="outline" size="icon" className="ml-2" aria-label="Copy Phone Number ID" onClick={() => handleCopy(phoneNumberId)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </StepCard>

      <StepFooter backHref={`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-2`}>
        <Button className="w-full sm:w-auto" disabled={!isSubscribed} onClick={handleContinue}>
          Finish setup <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </StepFooter>
    </div>
  )
}
