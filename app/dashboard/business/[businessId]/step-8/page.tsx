"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Copy, CheckCircle, AlertCircle } from "lucide-react"

export default function ReceiveTokensPage({ params }: { params: { businessId: string } }) {
  // Mock data for the tokens and IDs
  const tokens = {
    wabaId: "123456789012345",
    phoneNumberId: "987654321098765",
    apiToken: "EAABZCqZAZCZCZC...truncated...ZCZCZCZCZCZCZ",
  }

  const [copied, setCopied] = useState<Record<string, boolean>>({
    wabaId: false,
    phoneNumberId: false,
    apiToken: false,
  })

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopied({ ...copied, [key]: true })
    setTimeout(() => {
      setCopied({ ...copied, [key]: false })
    }, 2000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">WhatsApp Business API Credentials</CardTitle>
          <CardDescription>
            Save these credentials securely. You'll need them to connect to the WhatsApp Business API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-medium">Important Security Notice</p>
                <p className="mt-1 text-sm">
                  These credentials grant access to your WhatsApp Business Account. Store them securely and never share
                  them publicly.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">WhatsApp Business Account ID</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy("wabaId", tokens.wabaId)}
                  className="h-8 px-2"
                >
                  {copied.wabaId ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-2">{copied.wabaId ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">{tokens.wabaId}</div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Phone Number ID</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy("phoneNumberId", tokens.phoneNumberId)}
                  className="h-8 px-2"
                >
                  {copied.phoneNumberId ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="ml-2">{copied.phoneNumberId ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">{tokens.phoneNumberId}</div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">API Token</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy("apiToken", tokens.apiToken)}
                  className="h-8 px-2"
                >
                  {copied.apiToken ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-2">{copied.apiToken ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">
                {tokens.apiToken.substring(0, 20)}...
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-9`}>Continue to Setup Webhooks</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
