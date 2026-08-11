"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Bell,
  Settings,
  ExternalLink,
  Copy,
  CheckCircle2,
  Plus,
  Users,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"

// Mock data for WABA details
const WABA_DETAILS = {
  "1": {
    id: "1",
    name: "Acme Support",
    phoneNumber: "+1 (555) 123-4567",
    status: "Active",
    verificationStatus: "Verified",
    owner: "John Doe",
    businessName: "Acme Inc.",
    businessCategory: "Customer Support",
    createdAt: "Jan 15, 2023",
    apiKey: "EAABZCqZAZCZCZCZC...truncated...ZCZCZCZCZCZCZ",
    phoneNumberId: "987654321098765",
    wabaId: "123456789012345",
    messagesPerDay: 245,
    usagePercentage: 68,
    webhookUrl: "https://api.acme.com/webhooks/whatsapp",
    templates: [
      { id: "1", name: "Welcome Message", status: "Approved" },
      { id: "2", name: "Order Confirmation", status: "Approved" },
      { id: "3", name: "Appointment Reminder", status: "Pending" },
    ],
  },
  "2": {
    id: "2",
    name: "Acme Sales",
    phoneNumber: "+1 (555) 987-6543",
    status: "Pending",
    verificationStatus: "In Review",
    owner: "Jane Smith",
    businessName: "Acme Inc.",
    businessCategory: "Sales",
    createdAt: "Mar 22, 2023",
    apiKey: "",
    phoneNumberId: "",
    wabaId: "",
    messagesPerDay: 0,
    usagePercentage: 0,
    webhookUrl: "",
    templates: [],
  },
  "3": {
    id: "3",
    name: "Acme Marketing",
    phoneNumber: "+1 (555) 456-7890",
    status: "Active",
    verificationStatus: "Verified",
    owner: "Robert Johnson",
    businessName: "Acme Inc.",
    businessCategory: "Marketing",
    createdAt: "Feb 10, 2023",
    apiKey: "EAABZCqZAZCZCZCZC...truncated...ZCZCZCZCZCZCZ",
    phoneNumberId: "567890123456",
    wabaId: "345678901234",
    messagesPerDay: 178,
    usagePercentage: 42,
    webhookUrl: "https://api.acme.com/webhooks/marketing",
    templates: [
      { id: "1", name: "Promotional Offer", status: "Approved" },
      { id: "2", name: "New Product Launch", status: "Approved" },
    ],
  },
}

export default function WABADetailPage({ params }: { params: { wabaId: string } }) {
  const waba = WABA_DETAILS[params.wabaId as keyof typeof WABA_DETAILS]

  if (!waba) {
    return <div className="container mx-auto p-responsive">WhatsApp Business Account not found</div>
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-green-500 text-white">Active</Badge>
      case "Pending":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            Pending
          </Badge>
        )
      case "Suspended":
        return <Badge variant="destructive">Suspended</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "Verified":
        return <Badge className="bg-green-500 text-white">Verified</Badge>
      case "In Review":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            In Review
          </Badge>
        )
      case "Rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTemplateBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <Badge className="bg-green-500 text-white">Approved</Badge>
      case "Pending":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            Pending
          </Badge>
        )
      case "Rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto p-responsive">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/dashboard/waba">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to WABA List
            </Link>
          </Button>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <h1 className="text-xl sm:text-2xl font-bold">{waba.name}</h1>
            {getStatusBadge(waba.status)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link href={`/dashboard/waba/${waba.id}/edit`}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
          <Button size="sm" className="w-full sm:w-auto">
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phone Number</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{waba.phoneNumber}</div>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {waba.verificationStatus === "Verified" ? "Verified number" : "Verification pending"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages Per Day</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{waba.messagesPerDay}</div>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            <Progress value={waba.usagePercentage} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{waba.usagePercentage}% of daily limit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">{waba.templates.length}</div>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {waba.templates.filter((t) => t.status === "Approved").length} approved templates
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="overview" className="px-3 sm:px-4">
              Overview
            </TabsTrigger>
            <TabsTrigger value="templates" className="px-3 sm:px-4">
              Message Templates
            </TabsTrigger>
            <TabsTrigger value="api" className="px-3 sm:px-4">
              API & Webhooks
            </TabsTrigger>
            <TabsTrigger value="settings" className="px-3 sm:px-4">
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-responsive">
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Details about the business associated with this WABA</CardDescription>
            </CardHeader>
            <CardContent className="p-responsive">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Business Name</p>
                    <p className="text-base">{waba.businessName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Business Category</p>
                    <p className="text-base">{waba.businessCategory}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created On</p>
                    <p className="text-base">{waba.createdAt}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Account Owner</p>
                    <p className="text-base">{waba.owner}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Verification Status</p>
                    <div className="mt-1">{getVerificationBadge(waba.verificationStatus)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Account Status</p>
                    <div className="mt-1">{getStatusBadge(waba.status)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-responsive">
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest events for this account</CardDescription>
              </CardHeader>
              <CardContent className="p-responsive">
                <div className="space-y-4">
                  {waba.status === "Active" ? (
                    <>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                        <div>
                          <p className="text-sm">Message template approved</p>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span>Today</span>
                            <span className="mx-1">•</span>
                            <span>Welcome Message</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                        <div>
                          <p className="text-sm">200 messages sent</p>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span>Yesterday</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                        <div>
                          <p className="text-sm">Webhook configuration updated</p>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span>3 days ago</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-responsive">
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks for this account</CardDescription>
              </CardHeader>
              <CardContent className="p-responsive">
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/waba/${waba.id}/templates/new`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Template
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/waba/${waba.id}/webhooks`}>
                      <Bell className="h-4 w-4 mr-2" />
                      Configure Webhooks
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/waba/${waba.id}/test`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Test API
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Facebook Business Settings
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-responsive flex flex-col sm:flex-row sm:items-center justify-between">
              <div>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>Pre-approved message templates for your business</CardDescription>
              </div>
              <Button asChild className="mt-4 sm:mt-0">
                <Link href={`/dashboard/waba/${waba.id}/templates/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-responsive">
              {waba.templates.length > 0 ? (
                <div className="space-y-4">
                  {waba.templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4"
                    >
                      <div className="mb-2 sm:mb-0">
                        <p className="font-medium">{template.name}</p>
                        <div className="mt-1">{getTemplateBadge(template.status)}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Preview
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No templates created yet</p>
                  <Button className="mt-4" asChild>
                    <Link href={`/dashboard/waba/${waba.id}/templates/new`}>Create Your First Template</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-responsive">
              <CardTitle>API Credentials</CardTitle>
              <CardDescription>Authentication details for API access</CardDescription>
            </CardHeader>
            <CardContent className="p-responsive">
              {waba.status === "Active" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">WhatsApp Business Account ID</span>
                      <CopyButton text={waba.wabaId} />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">{waba.wabaId}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Phone Number ID</span>
                      <CopyButton text={waba.phoneNumberId} />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">
                      {waba.phoneNumberId}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">API Token</span>
                      <CopyButton text={waba.apiKey} />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">
                      {waba.apiKey.substring(0, 20)}...
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">
                    API credentials will be available once the account is active and verified
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-responsive">
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>Configure webhooks to receive real-time updates</CardDescription>
            </CardHeader>
            <CardContent className="p-responsive">
              {waba.status === "Active" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Webhook URL</span>
                      <CopyButton text={waba.webhookUrl} />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md font-mono text-sm overflow-x-auto">
                      {waba.webhookUrl || "Not configured"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium">Webhook Events</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {["messages", "message_status", "conversations", "errors"].map((event) => (
                        <div key={event} className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{event}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/waba/${waba.id}/webhooks`}>Configure Webhooks</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">
                    Webhook configuration will be available once the account is active
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-responsive">
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your WhatsApp Business Account settings</CardDescription>
            </CardHeader>
            <CardContent className="p-responsive">
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/dashboard/waba/${waba.id}/edit`}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Account Details
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/dashboard/waba/${waba.id}/phone`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Manage Phone Number
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/dashboard/waba/${waba.id}/users`}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Access
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-600" asChild>
                  <Link href={`/dashboard/waba/${waba.id}/delete`}>Delete Account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper component for copy buttons
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-2">
      {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
    </Button>
  )
}
