"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function PhoneVerificationPage({ params }: { params: { userId: string } }) {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [verificationSent, setVerificationSent] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSendVerification = () => {
    if (!phoneNumber) return

    // Simulate sending verification code
    setVerificationSent(true)
    // In a real app, you would call an API to send the verification code
  }

  const handleVerifyCode = () => {
    if (!verificationCode) return

    setIsVerifying(true)

    // Simulate verification process
    setTimeout(() => {
      setIsVerifying(false)
      router.push(`/dashboard/user/${params.userId}/step-7`)
    }, 1500)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Phone Number Verification</CardTitle>
          <CardDescription>Enter and verify the phone number for your WhatsApp Business Account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <p>
              This phone number will be used for your WhatsApp Business Account. Make sure it can receive SMS or voice
              calls for verification.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={verificationSent}
              />
              <p className="text-xs text-gray-500">
                Enter a full phone number including country code (e.g., +1 for US)
              </p>
            </div>

            {!verificationSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Verification Method</Label>
                  <RadioGroup defaultValue="sms">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sms" id="verification-sms" />
                      <Label htmlFor="verification-sms">SMS</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="call" id="verification-call" />
                      <Label htmlFor="verification-call">Voice Call</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handleSendVerification} disabled={!phoneNumber} className="w-full">
                  Send Verification Code
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" className="flex-1" onClick={() => setVerificationSent(false)}>
                    Change Number
                  </Button>
                  <Button className="flex-1" onClick={handleVerifyCode} disabled={!verificationCode || isVerifying}>
                    {isVerifying ? "Verifying..." : "Verify Code"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
