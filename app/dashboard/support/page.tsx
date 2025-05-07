"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SupportPage() {
  const [supportTicketSubmitted, setSupportTicketSubmitted] = useState(false)
  const [ticketCategory, setTicketCategory] = useState("")
  const [ticketSubject, setTicketSubject] = useState("")
  const [ticketDescription, setTicketDescription] = useState("")

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, you would submit the ticket to an API
    setSupportTicketSubmitted(true)
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Help & Support</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit a Support Ticket</CardTitle>
              <CardDescription>Our support team will respond as soon as possible</CardDescription>
            </CardHeader>
            <CardContent>
              {supportTicketSubmitted ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-green-100 p-3 mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium">Support Ticket Submitted</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Thank you for contacting us. Your support ticket has been submitted successfully. We'll get back to
                    you as soon as possible.
                  </p>
                  <Button className="mt-6" onClick={() => setSupportTicketSubmitted(false)}>
                    Submit Another Ticket
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={ticketCategory} onValueChange={setTicketCategory} required>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="account">Account Issues</SelectItem>
                        <SelectItem value="waba">WhatsApp Business Account</SelectItem>
                        <SelectItem value="api">API & Integration</SelectItem>
                        <SelectItem value="billing">Billing & Payments</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Brief description of your issue"
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Please provide as much detail as possible"
                      rows={6}
                      value={ticketDescription}
                      onChange={(e) => setTicketDescription(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="attachment">Attachment (Optional)</Label>
                    <Input id="attachment" type="file" />
                    <p className="text-xs text-muted-foreground">
                      Max file size: 10MB. Supported formats: JPG, PNG, PDF, DOC, DOCX.
                    </p>
                  </div>

                  <Button type="submit" className="w-full">
                    Submit Support Ticket
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Quick answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    question: "How do I reset my password?",
                    answer:
                      "You can reset your password by clicking on the 'Forgot Password' link on the login page. Follow the instructions sent to your email to create a new password.",
                  },
                  {
                    question: "Why was my message template rejected?",
                    answer:
                      "Message templates may be rejected if they contain promotional content without opt-in, prohibited content, or if they don't follow WhatsApp's formatting guidelines. Review the rejection reason and make the necessary changes before resubmitting.",
                  },
                  {
                    question: "How do I connect my WhatsApp Business Account?",
                    answer:
                      "Navigate to the WABA section in your dashboard, click 'Connect Account', and follow the step-by-step instructions to link your Facebook Business Manager and WhatsApp Business Account.",
                  },
                  {
                    question: "What are the messaging limits?",
                    answer:
                      "Messaging limits vary based on your account type and quality rating. New accounts start with lower limits that increase over time with good performance and compliance with WhatsApp policies.",
                  },
                ].map((faq, index) => (
                  <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                    <h4 className="font-medium mb-2">{faq.question}</h4>
                    <p className="text-muted-foreground text-sm">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Reach out to us directly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Email</h4>
                <p className="text-muted-foreground">support@example.com</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Phone</h4>
                <p className="text-muted-foreground">+1 (555) 123-4567</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Address</h4>
                <p className="text-muted-foreground">
                  123 Main Street
                  <br />
                  Anytown, USA
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
