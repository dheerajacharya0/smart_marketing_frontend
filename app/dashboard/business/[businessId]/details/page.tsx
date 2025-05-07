"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function BusinessDetailsPage({ params }: { params: { businessId: string } }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")

  // Mock business data
  const business = {
    id: params.businessId,
    name: "Acme Inc",
    type: "Retail",
    description: "A leading retail company specializing in consumer electronics and home appliances.",
    email: "contact@acmeinc.com",
    phone: "+1 (555) 123-4567",
    website: "https://www.acmeinc.com",
    status: "verified",
    createdAt: "April 12, 2023",
    owner: "John Doe",
    address: "123 Main St, Anytown, USA",
    setupProgress: 80,
  }

  // const setupSteps = [
  //   { id: "business_verification", name: "Business Verification", status: "complete" },
  //   { id: "profile_setup", name: "Business Profile", status: "complete" },
  //   { id: "commerce_settings", name: "Commerce Settings", status: "complete" },
  //   { id: "payment_methods", name: "Payment Methods", status: "complete" },
  //   { id: "catalog", name: "Product Catalog", status: "in_progress" },
  //   { id: "business_hours", name: "Business Hours", status: "pending" },
  //   { id: "team_access", name: "Team Access", status: "pending" },
  //   { id: "api_integration", name: "API Integration", status: "pending" },
  // ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500">Verified</Badge>
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "in_progress":
        return <Clock className="h-5 w-5 text-amber-500" />
      case "pending":
        return <AlertCircle className="h-5 w-5 text-gray-400" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/business">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Businesses
            </Link>
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">{business.name}</h2>
          {getStatusBadge(business.status)}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/business/${business.id}/step-1`}>Continue Setup</Link>
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="setup">Setup Progress</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Basic details about the business</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Business Name</dt>
                    <dd className="text-base">{business.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Business Type</dt>
                    <dd className="text-base">{business.type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                    <dd className="text-base">{business.description}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Owner</dt>
                    <dd className="text-base">{business.owner}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                    <dd className="text-base">{business.createdAt}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>How to reach the business</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                    <dd className="text-base">{business.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                    <dd className="text-base">{business.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Website</dt>
                    <dd className="text-base">{business.website}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Address</dt>
                    <dd className="text-base">{business.address}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Setup Progress</CardTitle>
              <CardDescription>Current status of business integration setup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{business.setupProgress}% Complete</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${business.setupProgress}%` }}></div>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/business/${business.id}/step-1`}>Continue Setup</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Setup Progress</CardTitle>
              <CardDescription>Track your business integration setup progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {setupSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start space-x-3 border-b pb-4 last:border-0 last:pb-0">
                    <div className="mt-0.5">{getStepStatusIcon(step.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{step.name}</h4>
                        <span className="text-xs capitalize text-muted-foreground">{step.status}</span>
                      </div>
                      {step.status !== "complete" && (
                        <Button variant="link" size="sm" className="p-0 h-auto mt-1" asChild>
                          <Link href={`/dashboard/business/${business.id}/step-${index + 1}`}>Complete this step</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Integrations</CardTitle>
              <CardDescription>Services connected to this business</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">WhatsApp Business API</h4>
                      <p className="text-sm text-muted-foreground">Connected on April 15, 2023</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>

                <div className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Facebook Catalog</h4>
                      <p className="text-sm text-muted-foreground">Integration in progress</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Continue Setup
                  </Button>
                </div>

                <Button className="w-full">Add New Integration</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs> */}
    </div>
  )
}
