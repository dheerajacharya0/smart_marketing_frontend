"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function BusinessDisplayNamePage({ params }: { params: { userId: string } }) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [businessDescription, setBusinessDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!businessName) return

    setIsSubmitting(true)

    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false)
      router.push(`/dashboard/user/${params.userId}/step-8`)
    }, 1000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Business Display Name</CardTitle>
          <CardDescription>Enter your business information for your WhatsApp Business Account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
              <p>
                This information will be visible to your customers on WhatsApp. Choose a name that represents your
                business clearly.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business Display Name</Label>
                <Input
                  id="business-name"
                  placeholder="e.g., Acme Inc. Support"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  This name will be displayed to your customers on WhatsApp (25 characters max)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-description">Business Description (Optional)</Label>
                <Textarea
                  id="business-description"
                  placeholder="Describe your business and the services you provide..."
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  This description helps customers understand what your business does (512 characters max)
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!businessName || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Business Information"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
