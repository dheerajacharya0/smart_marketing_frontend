"use client"

import { useRouter } from "next/navigation"
import { getErrorMessage } from "@/lib/errors"
import {
  ArrowRight,
  Check,
  ExternalLink,
  KeyRound,
  MessageSquare,
  MessageSquareText,
  Phone,
  PhoneCall,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getWhatsappBusinessAccount,
  isFacebookReconnectError,
  linkWhatsappPhone,
  type WhatsappBusinessAccountItem,
  registerWhatsappPhone,
  addWhatsappPhoneNumber,
  requestWhatsappVerificationCode,
  subscribeWhatsappWaba,
  verifyWhatsappCode,
} from "@/services/api"
import { useWhatsappPhoneNumbers } from "@/hooks/use-queries"
import { isNumberConnectedHere, isNumberRegistered } from "@/lib/onboarding-registration"
import { phoneDetailRows } from "@/lib/phone-details"
import { optionKey, wabaNumberOptions } from "@/lib/waba-number-options"
import { cn } from "@/lib/utils"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import {
  ActionPanel,
  Busy,
  OptionCard,
  OptionListSkeleton,
  Pill,
  SectionTitle,
  StatusNote,
  StepCard,
  StepFooter,
  StepHeader,
} from "@/components/onboarding/onboarding-ui"
import React from "react"

/** Rows already shown elsewhere on the card, so not repeated in its details. */
const SUMMARY_FIELDS = new Set(["Number", "Phone number ID"])

export default function WABASelectionPage({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const router = useRouter()
  const [waba, setWaba] = useState<WhatsappBusinessAccountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Meta rejected the stored login: only a fresh Facebook login fixes that.
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [selectedWaba, setSelectedWaba] = useState<WhatsappBusinessAccountItem | null>(null)
  const [pin, setPin] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)

  // New phone number flow (for WABAs with no phone number attached yet)
  const [newPhoneNumberId, setNewPhoneNumberId] = useState<string | null>(null)
  const [cc, setCc] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [verifiedName, setVerifiedName] = useState("")
  const [isAddingPhone, setIsAddingPhone] = useState(false)

  const [codeMethod, setCodeMethod] = useState<"SMS" | "VOICE">("SMS")
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [codeRequested, setCodeRequested] = useState(false)

  const [otpCode, setOtpCode] = useState("")
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [isCodeVerified, setIsCodeVerified] = useState(false)

  // When an existing number is stuck unverified, let the user choose to add a
  // different number for this WABA instead of waiting on the stuck one.
  const [useNewNumberInstead, setUseNewNumberInstead] = useState(false)

  // The failure of whichever action ran last, shown in the panel it belongs
  // to. These used to be toasts, which vanished before anyone read the reason.
  const [actionError, setActionError] = useState<string | null>(null)

  // Activation — subscribing our app to the WABA so messages reach us. It was
  // its own step with a single button; it now runs as soon as the number is
  // registered, and only surfaces here if it fails.
  const [isActivating, setIsActivating] = useState(false)
  const [activationError, setActivationError] = useState<string | null>(null)

  const fetchWABA = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsReconnect(false)
    try {
      const { data } = await getWhatsappBusinessAccount(unwrappedParams.wabaId)
      setWaba(Array.isArray(data) ? data : [])
    } catch (err) {
      setNeedsReconnect(isFacebookReconnectError(err))
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [unwrappedParams.wabaId])

  // Guards against React Strict Mode's dev-only double-invoke of this effect
  // (Refresh button below still calls fetchWABA directly, unaffected by this guard).
  const hasFetched = useRef(false)
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchWABA()
  }, [fetchWABA])

  // Our own rows for this account's numbers, to tell a number we already
  // registered from one that still needs it.
  const { data: ourNumbers } = useWhatsappPhoneNumbers(unwrappedParams.wabaId)

  const handleWabaSelection = (wabaItem: WhatsappBusinessAccountItem) => {
    // Clicking the WABA that is already picked used to start it over, which
    // cleared a successful register and left Continue disabled.
    // Compared by WABA *and* number: two numbers in one WABA are two options.
    if (optionKey(wabaItem) === optionKey(selectedWaba)) return
    setSelectedWaba(wabaItem)
    setIsRegistered(false)
    setPin("")
    setNewPhoneNumberId(null)
    setCc("")
    setPhoneNumber("")
    setVerifiedName("")
    setCodeMethod("SMS")
    setCodeRequested(false)
    setOtpCode("")
    setIsCodeVerified(false)
    setUseNewNumberInstead(false)
    setActionError(null)
    setActivationError(null)
  }

  // One option per number, not per WhatsApp account — see wabaNumberOptions.
  const options = useMemo(() => wabaNumberOptions(waba), [waba])

  // One number is the common case; don't make anyone click it.
  useEffect(() => {
    if (!selectedWaba && options.length === 1) handleWabaSelection(options[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selection only, once the list arrives
  }, [options])

  const handleAddPhoneNumber = async () => {
    if (!selectedWaba) return
    if (!cc || !phoneNumber || !verifiedName) {
      setActionError("Enter the country code, phone number and display name.")
      return
    }
    setActionError(null)
    setIsAddingPhone(true)
    try {
      const res = await addWhatsappPhoneNumber({
        accountId: unwrappedParams.wabaId,
        wabaId: selectedWaba.id,
        cc,
        phoneNumber,
        verifiedName,
      })
      const id = res?.data?.id || res?.id
      if (!id) throw new Error("Backend did not return a phone number id")
      setNewPhoneNumberId(id)
    } catch (err) {
      setActionError(getErrorMessage(err) || "We couldn't add this phone number.")
    } finally {
      setIsAddingPhone(false)
    }
  }

  // The number we're currently verifying: either a brand-new number we just added,
  // or an existing WABA phone number whose code_verification_status isn't VERIFIED yet.
  const verifyPhoneNumberId = newPhoneNumberId || selectedWaba?.details?.id

  const handleRequestCode = async () => {
    if (!verifyPhoneNumberId) return
    setActionError(null)
    setIsRequestingCode(true)
    try {
      await requestWhatsappVerificationCode({
        accountId: unwrappedParams.wabaId,
        phoneNumberId: verifyPhoneNumberId,
        codeMethod,
      })
      setCodeRequested(true)
    } catch (err) {
      setActionError(getErrorMessage(err) || "We couldn't send the verification code.")
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verifyPhoneNumberId) return
    if (!otpCode) {
      setActionError("Enter the code you received.")
      return
    }
    setActionError(null)
    setIsVerifyingCode(true)
    try {
      await verifyWhatsappCode({
        accountId: unwrappedParams.wabaId,
        phoneNumberId: verifyPhoneNumberId,
        code: otpCode,
      })
      setIsCodeVerified(true)
    } catch (err) {
      setActionError(getErrorMessage(err) || "That code didn't work. Check it and try again.")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const activePhoneNumberId = selectedWaba?.details?.id || newPhoneNumberId
  const isExistingPhoneVerified = selectedWaba?.details?.code_verification_status === "VERIFIED"

  // Connect the number here if it isn't yet, activate, then on to the finish.
  // Safe to repeat: linking writes the same row again, and subscribing an app
  // that is already subscribed is a no-op at Meta.
  //
  // `justRegistered`: the register call above already wrote our row; state
  // from that call hasn't re-rendered yet, so it is passed rather than read.
  const activateAndFinish = async ({ justRegistered = false }: { justRegistered?: boolean } = {}) => {
    if (!selectedWaba || !activePhoneNumberId) return
    setActivationError(null)
    setIsActivating(true)
    try {
      // A number Meta already has on the Cloud API skips the PIN, and used to
      // skip being recorded here with it — so it never reached the WhatsApp
      // list or the sender pickers.
      // `isRegistered` covers a retry after register succeeded and activation
      // didn't: the row is written, and our list may not have refetched yet.
      if (!justRegistered && !isRegistered && !isNumberConnectedHere(activePhoneNumberId, ourNumbers)) {
        await linkWhatsappPhone({
          accountId: unwrappedParams.wabaId,
          wabaId: selectedWaba.id,
          phoneNumberId: activePhoneNumberId,
        })
      }
      await subscribeWhatsappWaba({ accountId: unwrappedParams.wabaId, wabaId: selectedWaba.id })
      const query = new URLSearchParams({
        wabaId: selectedWaba.id,
        phoneNumberId: activePhoneNumberId,
      })
      router.push(`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-4?${query.toString()}`)
    } catch (err) {
      setActivationError(getErrorMessage(err) || "We couldn't finish connecting this number.")
    } finally {
      setIsActivating(false)
    }
  }

  const handleRegister = async () => {
    if (!selectedWaba) return
    if (!pin || pin.length !== 6) {
      setActionError("Enter a 6-digit PIN.")
      return
    }
    if (!activePhoneNumberId) {
      setActionError("This WhatsApp account has no phone number attached. Pick a different one.")
      return
    }
    setActionError(null)
    setIsRegistering(true)
    try {
      await registerWhatsappPhone({
        accountId: unwrappedParams.wabaId,
        wabaId: selectedWaba.id,
        phoneNumberId: activePhoneNumberId,
        pin,
      })
      setIsRegistered(true)
      // Straight on: nothing left to decide once the number is registered.
      await activateAndFinish({ justRegistered: true })
    } catch (err) {
      setActionError(getErrorMessage(err) || "We couldn't register this phone number.")
    } finally {
      setIsRegistering(false)
    }
  }

  // A live number needs neither a code nor a PIN again; only the number Meta
  // listed counts, not one just added on this page.
  const alreadyRegistered =
    !newPhoneNumberId && isNumberRegistered(selectedWaba?.details?.id, selectedWaba?.details, ourNumbers)
  // Registered with Meta is not the same as connected here — see isNumberConnectedHere.
  const alreadyConnectedHere = alreadyRegistered && isNumberConnectedHere(selectedWaba?.details?.id, ourNumbers)
  const canContinue = Boolean(selectedWaba) && (isRegistered || alreadyRegistered)

  const needsNewPhoneNumber = selectedWaba && !selectedWaba.details
  const needsVerification =
    selectedWaba &&
    !!selectedWaba.details &&
    !isExistingPhoneVerified &&
    !isCodeVerified &&
    !alreadyRegistered

  const showAddPhoneForm = Boolean((needsNewPhoneNumber || (needsVerification && useNewNumberInstead)) && !newPhoneNumberId)
  const showVerifyBlock = Boolean(
    !isCodeVerified && !showAddPhoneForm && verifyPhoneNumberId && (needsNewPhoneNumber || needsVerification)
  )
  const showRegisterBlock = Boolean(selectedWaba && !canContinue && (isExistingPhoneVerified || isCodeVerified))

  // The sub-steps this number goes through, for the progress line.
  const addsNumber = Boolean(needsNewPhoneNumber || useNewNumberInstead || newPhoneNumberId)
  const subSteps = [...(addsNumber ? ["Add number"] : []), "Verify", "Set PIN"]
  const currentSubStep = showAddPhoneForm
    ? "Add number"
    : showVerifyBlock
      ? "Verify"
      : showRegisterBlock
        ? "Set PIN"
        : null

  return (
    <div className="space-y-6">
      <StepHeader
        step={2}
        icon={<Phone className="h-6 w-6" />}
        title="Connect your WhatsApp number"
        description="Pick the WhatsApp account your customers will message. If its number isn't set up yet, we'll verify it and secure it with a PIN here."
      />

      <StepCard>
        <SectionTitle
          title="Your WhatsApp numbers"
          description="Every number in the WhatsApp accounts under the business you picked."
        />

        {loading ? (
          <OptionListSkeleton label="Loading your WhatsApp accounts…" />
        ) : error ? (
          <StatusNote
            tone="error"
            title={needsReconnect ? "Facebook connection expired" : "Couldn't load your WhatsApp accounts"}
            action={
              needsReconnect ? (
                <ConnectWhatsAppButton label="Reconnect Facebook" size="sm" askNumberType={false} onSuccess={fetchWABA} />
              ) : (
                <Button variant="outline" size="sm" onClick={fetchWABA}>
                  Try again
                </Button>
              )
            }
          >
            {needsReconnect
              ? "Facebook ended this login (for example after a password change), so we can't read your WhatsApp accounts. Reconnect Facebook to continue."
              : error}
          </StatusNote>
        ) : waba.length === 0 ? (
          <NoWabaYet onRefresh={fetchWABA} refreshing={loading} />
        ) : (
          <div role="radiogroup" aria-label="Your WhatsApp numbers" className="grid gap-3">
            {options.map((item) => {
              const selected = optionKey(selectedWaba) === optionKey(item)
              const registered = isNumberRegistered(item.details?.id, item.details, ourNumbers)
              const connectedHere = isNumberConnectedHere(item.details?.id, ourNumbers)
              const details = phoneDetailRows(item.details).filter((r) => !SUMMARY_FIELDS.has(r.label))
              return (
                <OptionCard
                  key={optionKey(item)}
                  selected={selected}
                  onSelect={() => handleWabaSelection(item)}
                  icon={<MessageSquare className="h-5 w-5" />}
                  title={item.name || "WhatsApp account"}
                  subtitle={item.details?.display_phone_number ?? "No phone number attached yet"}
                  badge={
                    <>
                      <NumberBadge item={item} registered={registered} connectedHere={connectedHere} />
                      {item.details?.is_on_biz_app ? <Pill tone="muted">Business app</Pill> : null}
                    </>
                  }
                >
                  {selected && details.length > 0 ? (
                    <span className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                      {details.map(({ label, value }) => (
                        <React.Fragment key={label}>
                          <span className="text-muted-foreground">{label}</span>
                          <span className="min-w-0 truncate">{value}</span>
                        </React.Fragment>
                      ))}
                    </span>
                  ) : null}
                </OptionCard>
              )
            })}
          </div>
        )}
      </StepCard>

      {/* Meta's is_on_biz_app: this number is also live in the WhatsApp
          Business app. Connecting it here works, but in app mode — and the
          chat/contact import only comes with the app flow, so say where. */}
      {selectedWaba?.details?.is_on_biz_app && !alreadyConnectedHere ? (
        <StatusNote tone="info" title="This number is also on the WhatsApp Business app">
          It will connect alongside the app: your phone keeps working, and Meta limits sending to 20 messages a
          second. To also bring over your existing chats and contacts, connect it instead with{" "}
          <strong>Connect WhatsApp → My WhatsApp Business app number</strong>.
        </StatusNote>
      ) : null}

      {currentSubStep ? <SubStepLine steps={subSteps} current={currentSubStep} /> : null}

      {showAddPhoneForm && (
        <ActionPanel
          icon={<PlusCircle className="h-5 w-5" />}
          title="Add a phone number"
          description={
            needsNewPhoneNumber
              ? "This WhatsApp account has no number yet. Add the one your customers will message."
              : "Add a different number for this WhatsApp account instead of the stuck one."
          }
        >
          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="cc">Country code</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  +
                </span>
                <Input
                  id="cc"
                  inputMode="numeric"
                  placeholder="91"
                  className="pl-6"
                  value={cc}
                  onChange={(e) => setCc(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone number</Label>
              <Input
                id="phone-number"
                inputMode="tel"
                placeholder="98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="verified-name">Display name</Label>
            <Input
              id="verified-name"
              placeholder="Your business name"
              value={verifiedName}
              onChange={(e) => setVerifiedName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              What customers see in WhatsApp. Meta reviews it, so use your real business name.
            </p>
          </div>
          {actionError ? <StatusNote tone="error">{actionError}</StatusNote> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {needsVerification && (
              <Button variant="ghost" onClick={() => setUseNewNumberInstead(false)}>
                Back to the existing number
              </Button>
            )}
            <Button onClick={handleAddPhoneNumber} disabled={isAddingPhone}>
              {isAddingPhone ? <Busy>Adding…</Busy> : "Add number"}
            </Button>
          </div>
        </ActionPanel>
      )}

      {showVerifyBlock && (
        <ActionPanel
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Verify your number"
          description={
            codeRequested
              ? `Enter the 6-digit code we sent by ${codeMethod === "SMS" ? "text message" : "voice call"}.`
              : "Meta sends a one-time code to prove the number is yours."
          }
        >
          {needsVerification && !newPhoneNumberId && (
            <StatusNote
              tone="warning"
              action={
                <Button variant="outline" size="sm" onClick={() => setUseNewNumberInstead(true)}>
                  Use a different number instead
                </Button>
              }
            >
              This number isn&apos;t verified yet. Verify it below, or use a different number if this one is stuck
              (for example, rate-limited by Meta).
            </StatusNote>
          )}
          {!codeRequested ? (
            <>
              <div className="space-y-2">
                <Label>Send the code by</Label>
                <div role="radiogroup" className="grid grid-cols-2 gap-2">
                  <MethodButton
                    selected={codeMethod === "SMS"}
                    onSelect={() => setCodeMethod("SMS")}
                    icon={<MessageSquareText className="h-4 w-4" />}
                    label="Text message"
                  />
                  <MethodButton
                    selected={codeMethod === "VOICE"}
                    onSelect={() => setCodeMethod("VOICE")}
                    icon={<PhoneCall className="h-4 w-4" />}
                    label="Voice call"
                  />
                </div>
              </div>
              {actionError ? <StatusNote tone="error">{actionError}</StatusNote> : null}
              <div className="flex justify-end">
                <Button onClick={handleRequestCode} disabled={isRequestingCode} className="w-full sm:w-auto">
                  {isRequestingCode ? <Busy>Sending…</Busy> : "Send code"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  maxLength={6}
                  className="h-12 text-center font-mono text-lg tracking-[0.5em]"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {actionError ? <StatusNote tone="error">{actionError}</StatusNote> : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={() => setCodeRequested(false)}>
                  Didn&apos;t get it? Send again
                </Button>
                <Button onClick={handleVerifyCode} disabled={isVerifyingCode}>
                  {isVerifyingCode ? <Busy>Verifying…</Busy> : "Verify"}
                </Button>
              </div>
            </>
          )}
        </ActionPanel>
      )}

      {showRegisterBlock && (
        <ActionPanel
          icon={<KeyRound className="h-5 w-5" />}
          title="Secure it with a PIN"
          description="Choose a 6-digit PIN for two-step verification. Keep it safe — you'll need the same PIN if this number is ever registered again."
        >
          {isCodeVerified ? <StatusNote tone="success">Number verified.</StatusNote> : null}
          <div className="space-y-2">
            <Label htmlFor="pin">6-digit PIN</Label>
            <Input
              id="pin"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              className="h-12 text-center font-mono text-lg tracking-[0.5em] sm:max-w-xs"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {actionError ? <StatusNote tone="error">{actionError}</StatusNote> : null}
          <div className="flex justify-end">
            <Button onClick={handleRegister} disabled={isRegistering || isActivating} className="w-full sm:w-auto">
              {isRegistering ? <Busy>Registering…</Busy> : isActivating ? <Busy>Activating…</Busy> : "Register & finish"}
            </Button>
          </div>
        </ActionPanel>
      )}

      {canContinue && !activationError ? (
        isRegistered ? (
          <StatusNote tone="success" title="Number registered">
            Finishing setup…
          </StatusNote>
        ) : alreadyConnectedHere ? (
          <StatusNote tone="success" title="Already connected">
            This number is already connected to this dashboard. Finish setup to make sure message delivery is on.
          </StatusNote>
        ) : (
          <StatusNote tone="info" title="Registered with Meta, not connected here yet">
            No code or PIN needed. Finish setup to connect it to this dashboard and switch on message delivery.
          </StatusNote>
        )
      ) : null}

      {activationError ? (
        <StatusNote
          tone="error"
          title="Couldn't finish connecting this number"
          action={
            <Button size="sm" onClick={() => activateAndFinish()} disabled={isActivating}>
              {isActivating ? <Busy>Retrying…</Busy> : "Try again"}
            </Button>
          }
        >
          {activationError}
        </StatusNote>
      ) : null}

      <StepFooter backHref={`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-1`}>
        <Button className="w-full sm:w-auto" disabled={!canContinue || isActivating} onClick={() => activateAndFinish()}>
          {isActivating ? (
            <Busy>Activating…</Busy>
          ) : (
            <>
              Finish setup <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </StepFooter>
    </div>
  )
}

/**
 * What state a WhatsApp account's number is in, at a glance. "Connected"
 * means connected to this app; a number only Meta has registered says so.
 */
function NumberBadge({
  item,
  registered,
  connectedHere,
}: {
  item: WhatsappBusinessAccountItem
  registered: boolean
  connectedHere: boolean
}) {
  if (!item.details) return <Pill tone="muted">No number</Pill>
  if (connectedHere) return <Pill tone="success">Connected</Pill>
  if (registered) return <Pill tone="info">Registered with Meta</Pill>
  if (item.details.code_verification_status === "VERIFIED") return <Pill tone="info">Verified</Pill>
  return <Pill tone="warning">Not verified</Pill>
}

/** Add number → Verify → Set PIN, with where this number is. */
function SubStepLine({ steps, current }: { steps: string[]; current: string }) {
  const at = steps.indexOf(current)
  return (
    <ol className="flex items-center gap-2 px-1 text-xs" aria-label="Number setup progress">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full font-semibold",
              i < at && "bg-success text-success-foreground",
              i === at && "bg-primary text-primary-foreground",
              i > at && "bg-muted text-muted-foreground"
            )}
          >
            {i < at ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn(i === at ? "font-medium text-foreground" : "text-muted-foreground")}>{step}</span>
          {i < steps.length - 1 ? <span aria-hidden className="h-px w-6 bg-border" /> : null}
        </li>
      ))}
    </ol>
  )
}

function MethodButton({
  selected,
  onSelect,
  icon,
  label,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-primary-soft text-primary ring-1 ring-primary" : "bg-background hover:bg-muted/50"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/** No WhatsApp account under this business yet: how to make one. */
function NoWabaYet({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="space-y-4 rounded-xl border border-dashed p-5">
      <div className="space-y-1">
        <p className="font-medium">No WhatsApp account under this business yet</p>
        <p className="text-sm text-muted-foreground">Create one in Meta Business Suite, then refresh this page.</p>
      </div>
      <ol className="space-y-2.5 text-sm">
        {[
          "Open Meta Business Suite and go to Business Settings.",
          "Under Accounts → WhatsApp accounts, click Add and follow the setup.",
          "Check the new account appears in your WhatsApp accounts list.",
          "Come back here and click Refresh.",
        ].map((text, i) => (
          <li key={text} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-muted-foreground">{text}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="sm" asChild>
          <a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" rel="noopener noreferrer">
            Open Meta Business Suite <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
        <Button size="sm" variant="soft" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Refresh
        </Button>
      </div>
    </div>
  )
}
