"use client"

import { ArrowRight, Building2, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState, useCallback, useMemo } from "react"
import {
  getUserDataFromCookie,
  getFacebookAccounts,
  getFacebookBusinessManagers,
  isFacebookReconnectError,
  setWhatsappBusinessDetails,
  syncBusiness,
} from "@/services/api"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import {
  Busy,
  OptionCard,
  OptionListSkeleton,
  SectionTitle,
  StatusNote,
  StepCard,
  StepFooter,
  StepHeader,
} from "@/components/onboarding/onboarding-ui"
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
    isFetching,
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

  // Whether Meta has ended this account's Facebook login. The business sync
  // doesn't fail on that — it comes back empty — so without this an expired
  // login read as "No business found" and sent people off to create a
  // business they already have. Same query key and shape as the Facebook
  // step, so this is usually already cached.
  const { data: facebookAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["facebook-accounts"],
    queryFn: async () => (await getFacebookAccounts()).filter((a) => a.type === "facebook"),
    enabled: Boolean(user?.id),
  })
  const loginExpired = Boolean(facebookAccounts?.find((a) => a.id === unwrappedParams.wabaId)?.needsReauth)

  // One business is the common case; don't make anyone click the only option.
  useEffect(() => {
    if (!selectedBusinessId && businesses.length === 1) setSelectedBusinessId(businesses[0].businessId)
  }, [businesses, selectedBusinessId])

  // Kept apart from the save failure below: one means "we couldn't read your
  // businesses", the other "we couldn't record the one you picked", and the
  // second must not be cleared by a background refetch of the first.
  // Meta rejecting the stored login (password change, security reset) is not
  // something "Try again" can fix — only a fresh Facebook login can.
  const needsReconnect =
    isFacebookReconnectError(loadError) || (loginExpired && !isLoading && businesses.length === 0)
  const readError =
    loadError || needsReconnect
    ? needsReconnect
      ? "Your Facebook connection has expired, so we can't read your businesses. Reconnect Facebook to continue."
      : "We couldn't load your businesses from Facebook."
    : null
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
      setSaveError("We couldn't save the business you picked. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }, [user, unwrappedParams, selectedBusiness, router])

  return (
    <div className="space-y-6">
      <StepHeader
        step={1}
        icon={<Building2 className="h-6 w-6" />}
        title="Choose your business"
        description="Pick the Meta Business account your WhatsApp number belongs to. We read this list from the Facebook account you just linked."
      />

      <StepCard>
        <SectionTitle
          title="Your businesses"
          description={businesses.length > 1 ? `${businesses.length} businesses found on this Facebook account.` : undefined}
        />

        {isLoading ? (
          <OptionListSkeleton label="Syncing your businesses from Facebook…" />
        ) : readError ? (
          // Not "No businesses found." — that sentence sends someone back
          // to Facebook to create a Business Manager they already have.
          <StatusNote
            tone="error"
            title={needsReconnect ? "Facebook connection expired" : "Couldn't load businesses"}
            action={
              needsReconnect ? (
                <ConnectWhatsAppButton
                  label="Reconnect Facebook"
                  size="sm"
                  askNumberType={false}
                  // Both: the login flag lives on the account, the list on the sync.
                  onSuccess={() => {
                    void refetchAccounts()
                    void refetch()
                  }}
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              )
            }
          >
            {readError}
          </StatusNote>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Building2 className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">No business found on this Facebook account</p>
              <p className="max-w-md text-sm text-muted-foreground">
                WhatsApp needs a Meta Business account. Create one in Meta Business Suite, or check you linked the
                Facebook login that manages it, then refresh.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" size="sm" asChild>
                <a href="https://business.facebook.com/overview" target="_blank" rel="noopener noreferrer">
                  Open Meta Business Suite <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="sm" variant="soft" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Refresh
              </Button>
            </div>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Your businesses" className="grid gap-3">
            {businesses.map((business) => (
              <OptionCard
                key={business.businessId}
                selected={selectedBusinessId === business.businessId}
                onSelect={() => setSelectedBusinessId(business.businessId)}
                icon={<Building2 className="h-5 w-5" />}
                title={business.name || "Unnamed business"}
                subtitle={<span className="font-mono text-xs">ID {business.businessId}</span>}
              />
            ))}
          </div>
        )}

        {saveError ? (
          <div className="mt-4">
            <StatusNote tone="error">{saveError}</StatusNote>
          </div>
        ) : null}
      </StepCard>

      <StepFooter backHref="/dashboard/whatsapp/new">
        <Button className="w-full sm:w-auto" disabled={!selectedBusinessId || isSubmitting} onClick={handleContinue}>
          {isSubmitting ? (
            <Busy>Saving…</Busy>
          ) : (
            <>
              Continue to WhatsApp number <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </StepFooter>
    </div>
  )
}
