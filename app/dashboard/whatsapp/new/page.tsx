"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Facebook, Phone, Store } from "lucide-react"

export default function NewWhatsAppIntegrationPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [businessType, setBusinessType] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, you would create the account here
    // For now, we'll just redirect to the first step of the integration
    router.push("/dashboard/whatsapp/waba1/step-1")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">New WhatsApp Business Integration</h2>
        <p className="text-muted-foreground mt-2">
          Set up a new WhatsApp Business API account to start sending and receiving messages.
        </p>
      </div>

      <Tabs defaultValue="guided" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guided">Guided Setup</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Setup</TabsTrigger>
        </TabsList>
        <TabsContent value="guided" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Guided WhatsApp Business Setup</CardTitle>
              <CardDescription>
                We'll guide you through the process of setting up your WhatsApp Business API account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    placeholder="Enter your business name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="phone-number">Phone Number</Label>
                  <Input
                    id="phone-number"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    This number will be used for your WhatsApp Business account. It should not be currently used with
                    WhatsApp.
                  </p>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="business-type">Business Type</Label>
                  <Input
                    id="business-type"
                    placeholder="e.g. Retail, Healthcare, Technology"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Integration Steps</h3>
                <div className="grid gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Facebook className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Connect with Facebook</h4>
                      <p className="text-sm text-muted-foreground">
                        Link your Facebook Business Manager account to get started.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Verify Phone Number</h4>
                      <p className="text-sm text-muted-foreground">
                        Verify your business phone number via SMS or voice call.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Complete Business Profile</h4>
                      <p className="text-sm text-muted-foreground">
                        Set up your business profile and get verified to unlock all features.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="ml-auto" onClick={handleSubmit}>
                Start Integration <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="advanced" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Setup</CardTitle>
              <CardDescription>
                For developers and advanced users who want to set up the WhatsApp Business API manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <h3 className="text-sm font-medium mb-2">API Integration Steps</h3>
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>Create a Facebook Developer account</li>
                    <li>Set up a Facebook Business Manager</li>
                    <li>Create a WhatsApp Business Account (WABA)</li>
                    <li>Set up a Meta App and add the WhatsApp product</li>
                    <li>Generate a permanent access token</li>
                    <li>Configure webhooks for receiving messages</li>
                    <li>Implement the WhatsApp Business API in your backend</li>
                  </ol>
                </div>
                <p className="text-sm text-muted-foreground">
                  For detailed instructions, refer to our{" "}
                  <a href="#" className="text-primary hover:underline">
                    API documentation
                  </a>{" "}
                  or contact our support team.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="mr-2">
                View API Docs
              </Button>
              <Button onClick={() => router.push("/dashboard/whatsapp/waba1/step-1")}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
