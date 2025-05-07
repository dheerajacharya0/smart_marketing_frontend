import Link from "next/link"
import { ArrowRight, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function PhoneVerificationPage({ params }: { params: { wabaId: string } }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Enter Phone Number & Verify It</h2>
        <p className="text-muted-foreground">Add and verify a phone number for your WhatsApp Business Account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phone Number Verification</CardTitle>
          <CardDescription>This phone number will be used for your WhatsApp Business API account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex space-x-2">
                <Input id="country-code" placeholder="+1" className="w-20" />
                <Input id="phone" placeholder="Enter phone number" className="flex-1" />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a phone number that hasn't been used with WhatsApp before.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Verification Method</Label>
              <RadioGroup defaultValue="sms">
                <div className="flex items-center space-x-3 p-3 border rounded-md">
                  <RadioGroupItem value="sms" id="sms" />
                  <Label htmlFor="sms" className="flex-1">
                    <div className="font-medium">SMS</div>
                    <div className="text-xs text-muted-foreground">Receive a verification code via SMS</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-md">
                  <RadioGroupItem value="call" id="call" />
                  <Label htmlFor="call" className="flex-1">
                    <div className="font-medium">Phone Call</div>
                    <div className="text-xs text-muted-foreground">Receive a verification code via phone call</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <Button className="w-full">
            <Phone className="mr-2 h-4 w-4" /> Send Verification Code
          </Button>

          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input id="verification-code" placeholder="Enter verification code" />
            <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your phone.</p>
          </div>

          <Button variant="outline">Verify Code</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-7`}>
            Continue to Business Display Name <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
