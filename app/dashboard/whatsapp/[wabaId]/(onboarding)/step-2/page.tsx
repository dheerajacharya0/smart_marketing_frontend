"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, MessageSquare, Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  getWhatsappBusinessAccount,
  registerWhatsappPhone,
  addWhatsappPhoneNumber,
  requestWhatsappVerificationCode,
  verifyWhatsappCode,
} from "@/services/api"
import { toast } from "react-hot-toast"
import { Input } from "@/components/ui/input"
import React from "react"

export default function WABASelectionPage({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const router = useRouter()
  const [waba, setWaba] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWaba, setSelectedWaba] = useState<any>(null)
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

  const fetchWABA = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getWhatsappBusinessAccount(unwrappedParams.wabaId)
      setWaba(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message)
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

  const handleWabaSelection = (wabaItem: any) => {
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
  }

  const handleAddPhoneNumber = async () => {
    if (!cc || !phoneNumber || !verifiedName) {
      toast.error("Enter country code, phone number, and display name")
      return
    }
    setIsAddingPhone(true)
    try {
      const res: any = await addWhatsappPhoneNumber({
        accountId: unwrappedParams.wabaId,
        wabaId: selectedWaba.id,
        cc,
        phoneNumber,
        verifiedName,
      })
      const id = res?.data?.id || res?.id
      if (!id) throw new Error("Backend did not return a phone number id")
      setNewPhoneNumberId(id)
      toast.success("Phone number added. Now verify it.")
    } catch (err: any) {
      toast.error(err.message || "Failed to add phone number")
    } finally {
      setIsAddingPhone(false)
    }
  }

  // The number we're currently verifying: either a brand-new number we just added,
  // or an existing WABA phone number whose code_verification_status isn't VERIFIED yet.
  const verifyPhoneNumberId = newPhoneNumberId || selectedWaba?.details?.id

  const handleRequestCode = async () => {
    if (!verifyPhoneNumberId) return
    setIsRequestingCode(true)
    try {
      await requestWhatsappVerificationCode({
        accountId: unwrappedParams.wabaId,
        phoneNumberId: verifyPhoneNumberId,
        codeMethod,
      })
      setCodeRequested(true)
      toast.success(`Verification code sent via ${codeMethod}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification code")
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verifyPhoneNumberId) return
    if (!otpCode) {
      toast.error("Enter the verification code")
      return
    }
    setIsVerifyingCode(true)
    try {
      await verifyWhatsappCode({
        accountId: unwrappedParams.wabaId,
        phoneNumberId: verifyPhoneNumberId,
        code: otpCode,
      })
      setIsCodeVerified(true)
      toast.success("Phone number verified")
    } catch (err: any) {
      toast.error(err.message || "Failed to verify code")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const activePhoneNumberId = selectedWaba?.details?.id || newPhoneNumberId
  const isExistingPhoneVerified = selectedWaba?.details?.code_verification_status === "VERIFIED"

  const handleRegister = async () => {
    if (!pin || pin.length !== 6) {
      toast.error("Enter a 6-digit PIN")
      return
    }
    if (!activePhoneNumberId) {
      toast.error("This WhatsApp Business Account has no phone number attached. Pick a different one.")
      return
    }
    setIsRegistering(true)
    try {
      await registerWhatsappPhone({
        accountId: unwrappedParams.wabaId,
        wabaId: selectedWaba.id,
        phoneNumberId: activePhoneNumberId,
        pin,
      })
      toast.success("Phone number registered")
      setIsRegistered(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to register phone number")
    } finally {
      setIsRegistering(false)
    }
  }

  const handleContinue = () => {
    if (!selectedWaba || !activePhoneNumberId) return
    const query = new URLSearchParams({
      wabaId: selectedWaba.id,
      phoneNumberId: activePhoneNumberId,
    })
    router.push(`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-3?${query.toString()}`)
  }

  const needsNewPhoneNumber = selectedWaba && !selectedWaba.details
  const needsVerification =
    selectedWaba && !!selectedWaba.details && !isExistingPhoneVerified && !isCodeVerified

  const showAddPhoneForm = Boolean((needsNewPhoneNumber || (needsVerification && useNewNumberInstead)) && !newPhoneNumberId)
  const showVerifyBlock = Boolean(
    !isCodeVerified && !showAddPhoneForm && verifyPhoneNumberId && (needsNewPhoneNumber || needsVerification)
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Connect Your WhatsApp Number</h2>
        <p className="text-muted-foreground">
          Pick the WhatsApp number your customers will message, then verify it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your WhatsApp Number</CardTitle>
          <CardDescription>Found under the business you selected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin h-6 w-6 text-primary" />
              <span className="ml-2 text-primary">Loading WABA...</span>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive text-destructive px-4 py-3 mb-4">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}

          {!loading && !error && (
            <RadioGroup value={selectedWaba?.id ?? ""}>
              {waba.length > 0 ? (
                waba.map((item: any) => (
                  <div key={item.id} className="flex flex-col space-y-2 p-3 border rounded-md">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={item.id}
                        id={item.id}
                        onClick={() => handleWabaSelection(item)}
                      />
                      <Label htmlFor={item.id} className="flex-1 font-medium">
                        {item.name}
                      </Label>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="pl-8">
                      {item.details ? (
                        Object.entries(item.details).map(([key, value]) => (
                          <div key={key} className="text-xs text-muted-foreground">
                            <span className="font-semibold">{key}:</span> {String(value)}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground italic">No phone number attached yet.</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <div className="text-sm font-medium">No WhatsApp Business Account found yet.</div>
                  <p className="text-xs text-muted-foreground">
                    Create/link one manually in Meta Business Suite, then refresh below:
                  </p>
                  <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
                    <li>Go to business.facebook.com and open your Business Settings.</li>
                    <li>
                      Under <strong>Accounts &gt; WhatsApp Accounts</strong>, click "Add" and follow the
                      setup to create a new WhatsApp Business Account (or link an existing number).
                    </li>
                    <li>Confirm the WABA appears under your business's WhatsApp Accounts list.</li>
                    <li>Come back here and click "Refresh" to pull in the newly linked WABA.</li>
                  </ol>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://business.facebook.com/settings/whatsapp-business-accounts"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Meta Business Suite <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    <Button size="sm" onClick={fetchWABA} disabled={loading}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                  </div>
                </div>
              )}
            </RadioGroup>
          )}

          {showAddPhoneForm && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium">Add a Phone Number</h4>
              <p className="text-xs text-muted-foreground">
                {needsNewPhoneNumber
                  ? "This WABA has no phone number yet. Add one to continue."
                  : "Add a different phone number for this WABA instead of the stuck one."}
              </p>
              {needsVerification && (
                <Button variant="ghost" size="sm" onClick={() => setUseNewNumberInstead(false)}>
                  ← Back to verifying the existing number
                </Button>
              )}
              <div className="space-y-2">
                <Label htmlFor="cc">Country Code</Label>
                <Input
                  id="cc"
                  placeholder="1"
                  value={cc}
                  onChange={(e) => setCc(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone-number">Phone Number (without country code)</Label>
                <Input
                  id="phone-number"
                  placeholder="5556613879"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verified-name">Display Name</Label>
                <Input
                  id="verified-name"
                  placeholder="My Business"
                  value={verifiedName}
                  onChange={(e) => setVerifiedName(e.target.value)}
                />
              </div>
              <Button onClick={handleAddPhoneNumber} disabled={isAddingPhone} className="w-full">
                {isAddingPhone ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
                  </>
                ) : (
                  "Add Phone Number"
                )}
              </Button>
            </div>
          )}

          {showVerifyBlock && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium">Verify Phone Number</h4>
              {needsVerification && !newPhoneNumberId && (
                <>
                  <p className="text-xs text-muted-foreground">
                    This number's status is <strong>{selectedWaba.details.code_verification_status || "NOT_VERIFIED"}</strong>.
                    Verify it before registering, or use a different number instead if this one is stuck
                    (e.g. rate-limited by Meta).
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setUseNewNumberInstead(true)}>
                    Use a different number instead
                  </Button>
                </>
              )}
              {!codeRequested ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Choose how you want to receive the verification code.
                  </p>
                  <Select value={codeMethod} onValueChange={(v) => setCodeMethod(v as "SMS" | "VOICE")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="VOICE">Voice call</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleRequestCode} disabled={isRequestingCode} className="w-full">
                    {isRequestingCode ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Enter the code sent via {codeMethod}.
                  </p>
                  <Input
                    placeholder="Verification code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <Button onClick={handleVerifyCode} disabled={isVerifyingCode} className="w-full">
                    {isVerifyingCode ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCodeRequested(false)}
                    className="w-full"
                  >
                    Didn't get a code? Try again
                  </Button>
                </>
              )}
            </div>
          )}

          {selectedWaba && !isRegistered && (isExistingPhoneVerified || isCodeVerified) && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium">Register This Number</h4>
              <p className="text-xs text-muted-foreground">
                Choose a 6-digit PIN for two-step verification. You'll need this same PIN if you ever
                re-register this number.
              </p>
              <Input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              <Button onClick={handleRegister} disabled={isRegistering} className="w-full">
                {isRegistering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                  </>
                ) : (
                  "Register Number"
                )}
              </Button>
            </div>
          )}

          {selectedWaba && isRegistered && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 px-4 py-3 text-sm text-green-700">
              Number registered successfully.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={!selectedWaba || !isRegistered} onClick={handleContinue}>
          Continue to Webhooks <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
