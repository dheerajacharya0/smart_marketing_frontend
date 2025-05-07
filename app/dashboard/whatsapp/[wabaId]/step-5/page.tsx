"use client"

import Link from "next/link"
import { ArrowRight, MessageSquare, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { getWhatsappBusinessAccount } from "@/services/api"
import { toast } from "react-hot-toast"
import { Input } from "@/components/ui/input"

export default function WABACreationPage({ params }: { params: { wabaId: string } }) {
  const [waba, setWaba] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWaba, setSelectedWaba] = useState<any>(null)
  const [verificationStep, setVerificationStep] = useState<'initial' | 'request_code' | 'verify_code'>('initial')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  useEffect(() => {
    async function fetchWABA() {
      setLoading(true)
      setError(null)
      try {
        const {data} = await getWhatsappBusinessAccount(params.wabaId);
        setWaba(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchWABA()
  }, [params.wabaId])

  const handleWabaSelection = (wabaItem: any) => {
    setSelectedWaba(wabaItem)
    if (wabaItem.details.code_verification_status === 'NOT_VERIFIED') {
      setVerificationStep('request_code')
    }
  }

  const handleRequestCode = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number')
      return
    }
    setIsRequestingCode(true)
    try {
      // TODO: Implement actual API call to request verification code
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulated API call
      toast.success('Verification code sent successfully')
      setVerificationStep('verify_code')
    } catch (error) {
      toast.error('Failed to send verification code')
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }
    setIsVerifyingCode(true)
    try {
      // TODO: Implement actual API call to verify code
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulated API call
      toast.success('Phone number verified successfully')
      setVerificationStep('initial')
      setSelectedWaba(null)
    } catch (error) {
      toast.error('Failed to verify code')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Create or Choose WhatsApp Business Account</h2>
        <p className="text-muted-foreground">
          Select an existing WhatsApp Business Account (WABA) or create a new one.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Business Account</CardTitle>
          <CardDescription>A WhatsApp Business Account is required to use the WhatsApp Business API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Select an existing WABA:</h3>

            {/* Loader */}
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="animate-spin h-6 w-6 text-primary" />
                <span className="ml-2 text-primary">Loading WABA...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive text-destructive px-4 py-3 mb-4">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {/* WABA List */}
            {!loading && !error && (
              <RadioGroup>
                {Array.isArray(waba) && waba.length > 0 ? (
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
                        {Object.entries(item.details).map(([key, value]) => (
                          <div key={key} className="text-xs text-muted-foreground">
                            <span className="font-semibold">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-sm">No WABA found.</div>
                )}
              </RadioGroup>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-4">
            <div className="h-px flex-1 bg-border"></div>
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          <div className="space-y-4">
            <Button variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Create New WhatsApp Business Account
            </Button>

            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Creating a new WABA requires:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
                <li>A verified business in Business Manager</li>
                <li>Admin access to your Business Manager</li>
                <li>A phone number not previously used with WhatsApp</li>
                <li>Compliance with WhatsApp's Business Policy</li>
              </ul>
            </div>
          </div>

          {/* Verification Flow */}
          {verificationStep === 'request_code' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium">Phone Number Verification Required</h4>
              <div className="space-y-2">
                <Label htmlFor="phone">Enter Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <Button 
                  onClick={handleRequestCode} 
                  disabled={isRequestingCode}
                  className="w-full"
                >
                  {isRequestingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </Button>
              </div>
            </div>
          )}

          {verificationStep === 'verify_code' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <h4 className="font-medium">Enter Verification Code</h4>
              <div className="space-y-2">
                <Label htmlFor="code">6-digit Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
                <Button 
                  onClick={handleVerifyCode} 
                  disabled={isVerifyingCode}
                  className="w-full"
                >
                  {isVerifyingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          asChild 
          disabled={verificationStep !== 'initial'}
        >
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-6`}>
            Continue to Phone Verification <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
