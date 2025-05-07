"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { canUserCreateBusiness, getUserBusinessCount, getUserById } from "@/lib/user-model"
import { getSubscriptionPlan } from "@/lib/subscription-plans"

// For demo purposes, we'll use a hardcoded user ID
const CURRENT_USER_ID = "user1"

export default function NewBusinessPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [businessDescription, setBusinessDescription] = useState("")
  const [businessEmail, setBusinessEmail] = useState("")
  const [businessPhone, setBusinessPhone] = useState("")

  // Subscription limit check
  const [canCreate, setCanCreate] = useState(true)
  const [businessCount, setBusinessCount] = useState(0)
  const [businessLimit, setBusinessLimit] = useState(0)
  const [subscriptionName, setSubscriptionName] = useState("")

  useEffect(() => {
    // In a real app, you would get the current user from authentication
    const user = getUserById(CURRENT_USER_ID)
    if (user) {
      const count = getUserBusinessCount(user.id)
      const plan = getSubscriptionPlan(user.subscription.tier)

      setBusinessCount(count)
      setBusinessLimit(plan.businessLimit)
      setSubscriptionName(plan.name)
      setCanCreate(canUserCreateBusiness(user.id))
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!canCreate) {
      return
    }

    setIsSubmitting(true)

    // Simulate API call to create a new business
    setTimeout(() => {
      setIsSubmitting(false)
      // Generate a random business ID
      const businessId = Math.random().toString(36).substring(2, 10)
      router.push(`/dashboard/business/${businessId}/step-1`)
    }, 1500)
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/business">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Businesses
            </Link>
          </Button>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">New Business Integration</h2>
      </div>

      {!canCreate && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Subscription Limit Reached</AlertTitle>
          <AlertDescription>
            Your {subscriptionName} plan allows {businessLimit} business{businessLimit !== 1 ? "es" : ""}. You currently
            have {businessCount} business{businessCount !== 1 ? "es" : ""}. Please upgrade your subscription to create
            more businesses.
          </AlertDescription>
        </Alert>
      )}

      {canCreate && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Subscription Information</AlertTitle>
          <AlertDescription>
            Your {subscriptionName} plan allows {businessLimit} business{businessLimit !== 1 ? "es" : ""}. You currently
            have {businessCount} business{businessCount !== 1 ? "es" : ""}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            Enter your business details to get started with WhatsApp Business integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="new-business-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business Name</Label>
                <Input
                  id="business-name"
                  placeholder="Enter your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  disabled={!canCreate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-type">Business Type</Label>
                <Select value={businessType} onValueChange={setBusinessType} disabled={!canCreate}>
                  <SelectTrigger id="business-type">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="services">Services</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="food">Food & Beverage</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-description">Business Description</Label>
                <Textarea
                  id="business-description"
                  placeholder="Describe your business..."
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={4}
                  disabled={!canCreate}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-email">Business Email</Label>
                  <Input
                    id="business-email"
                    type="email"
                    placeholder="contact@yourbusiness.com"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    required
                    disabled={!canCreate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-phone">Business Phone</Label>
                  <Input
                    id="business-phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    required
                    disabled={!canCreate}
                  />
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/dashboard/business">Cancel</Link>
          </Button>
          <Button
            type="submit"
            form="new-business-form"
            disabled={isSubmitting || !canCreate || !businessName || !businessType || !businessEmail || !businessPhone}
          >
            {isSubmitting ? "Creating..." : "Start Business Integration"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
