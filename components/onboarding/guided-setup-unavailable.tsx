"use client"

import Link from "next/link"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import { StatusNote, StepCard } from "@/components/onboarding/onboarding-ui"
import { embeddedSignupReady } from "@/lib/facebook-sdk"

/**
 * Stands in for the step-by-step setup pages while GUIDED_SETUP_ENABLED is
 * off (lib/guided-setup.ts). Many "Connect an account" links across the app
 * point at /dashboard/whatsapp/new, so this keeps a working way in: the
 * Facebook pop-up, which doesn't depend on the permission under review.
 *
 * `inFrame`: already inside the onboarding layout (step-1), which brings its
 * own back link and heading.
 */
export function GuidedSetupUnavailable({ inFrame = false }: { inFrame?: boolean }) {
  // Set from onSuccess, not by navigating from onDone: the success screen's
  // "Open inbox" link also fires onDone, and a push here would race it.
  const [connected, setConnected] = useState(false)
  const queryClient = useQueryClient()

  const card = (
    <StepCard>
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <Clock className="h-6 w-6" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Step-by-step setup is under review</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Meta is reviewing this setup route. It will be available soon.
            </p>
          </div>
        </div>

        {embeddedSignupReady ? (
          <>
            {connected ? (
              <StatusNote
                tone="success"
                title="WhatsApp connected"
                action={
                  <Button asChild size="sm">
                    <Link href="/dashboard/whatsapp">Go to your WhatsApp numbers</Link>
                  </Button>
                }
              />
            ) : (
              <StatusNote tone="info" title="You can still connect your number now">
                Connect with Facebook in a pop-up instead. It takes about 3 minutes and works for a new number or your
                WhatsApp Business app number.
              </StatusNote>
            )}

            {/* Stays mounted after success: unmounting it would close the
                dialog before its success screen is read. "hide": its
                unconfigured fallback links back to this page. */}
            <ConnectWhatsAppButton
              label={connected ? "Connect another number" : "Connect with Facebook"}
              variant={connected ? "outline" : undefined}
              className="w-full sm:w-auto"
              unconfiguredFallback="hide"
              onSuccess={() => {
                setConnected(true)
                // A new number changes the accounts list, the number switcher and
                // plan usage; refetch them rather than show 30s-stale caches.
                void queryClient.invalidateQueries()
              }}
            />
          </>
        ) : (
          // Neither route is available (Embedded Signup not configured on this
          // deployment): say so rather than show a button that does nothing.
          <StatusNote tone="warning" title="Connecting WhatsApp is not available right now">
            Please check back soon, or contact support if you need your number connected sooner.
          </StatusNote>
        )}
      </div>
    </StepCard>
  )

  if (inFrame) return card

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <div className="space-y-5">
        <Link
          href="/dashboard/whatsapp"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          WhatsApp
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Connect WhatsApp</h1>
      </div>
      {card}
    </div>
  )
}
