"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ResponsiveCard } from "@/components/ui/responsive-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Briefcase,
  CreditCard,
  MessageSquare,
  Users,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react"

// Mock data for demonstration
const userData = {
  id: "user1",
  name: "John Doe",
  email: "john@example.com",
  subscription: {
    tier: "premium",
    plan: "Premium",
    isActive: true,
    expiresAt: "2023-12-31",
    limits: {
      maxBusinesses: 10,
      maxPhoneNumbers: 5,
      maxMonthlyMessages: 10000,
    },
  },
}

const subscriptionPlans = {
  free: { name: "Free", businessLimit: 1 },
  basic: { name: "Basic", businessLimit: 3 },
  premium: { name: "Premium", businessLimit: 10 },
  enterprise: { name: "Enterprise", businessLimit: 50 },
}

// Mock businesses data
const businesses = [
  { id: "biz1", name: "Acme Corp", industry: "Technology", status: "active", created: "2023-04-12" },
  { id: "biz2", name: "XYZ Industries", industry: "Manufacturing", status: "pending", created: "2023-04-10" },
  { id: "biz3", name: "ABC Solutions", industry: "Consulting", status: "active", created: "2023-04-08" },
  { id: "biz4", name: "Global Services", industry: "Services", status: "inactive", created: "2023-04-05" },
]

export default function DashboardPage() {
  const router = useRouter()
  const [businessCount, setBusinessCount] = useState(businesses.length)
  const [businessLimit, setBusinessLimit] = useState(userData.subscription.limits.maxBusinesses)
  const [subscriptionName, setSubscriptionName] = useState(userData.subscription.plan)
  const [businessPercentage, setBusinessPercentage] = useState(
    Math.min(100, (businessCount / userData.subscription.limits.maxBusinesses) * 100),
  )
  const [phoneNumberCount, setPhoneNumberCount] = useState(2) // Mock data
  const [phoneNumberLimit, setPhoneNumberLimit] = useState(userData.subscription.limits.maxPhoneNumbers)
  const [phoneNumberPercentage, setPhoneNumberPercentage] = useState(
    Math.min(100, (phoneNumberCount / userData.subscription.limits.maxPhoneNumbers) * 100),
  )
  const [messageCount, setMessageCount] = useState(4280) // Mock data
  const [messageLimit, setMessageLimit] = useState(userData.subscription.limits.maxMonthlyMessages)
  const [messagePercentage, setMessagePercentage] = useState(
    Math.min(100, (messageCount / userData.subscription.limits.maxMonthlyMessages) * 100),
  )

  useEffect(() => {
    // In a real app, you would fetch this data from an API
    const plan = subscriptionPlans[userData.subscription.tier]
    if (plan) {
      setBusinessLimit(userData.subscription.limits.maxBusinesses)
      setSubscriptionName(userData.subscription.plan)
      setBusinessPercentage(Math.min(100, (businessCount / userData.subscription.limits.maxBusinesses) * 100))
      setPhoneNumberPercentage(Math.min(100, (phoneNumberCount / userData.subscription.limits.maxPhoneNumbers) * 100))
      setMessagePercentage(Math.min(100, (messageCount / userData.subscription.limits.maxMonthlyMessages) * 100))
    }
  }, [businessCount, phoneNumberCount, messageCount])

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome back, {userData.name}</h2>
          <p className="text-muted-foreground mt-1">Here's what's happening with your WhatsApp Business accounts.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => router.push("/dashboard/business/new")}>
            <Briefcase className="mr-2 h-4 w-4" /> New Business
          </Button>
        </div>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-medium">Subscription Status</AlertTitle>
        <AlertDescription>
          You're currently on the <span className="font-medium">{subscriptionName}</span> plan with {businessCount} of{" "}
          {businessLimit} businesses created.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-background border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ResponsiveCard className="whatsapp-card">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Total Users</h3>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">12</div>
              <div className="flex items-center mt-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">+2</span>
                <span className="text-muted-foreground ml-1">from last month</span>
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="whatsapp-card">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">WhatsApp Accounts</h3>
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">7</div>
              <div className="flex items-center mt-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-500 font-medium">+1</span>
                <span className="text-muted-foreground ml-1">from last month</span>
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="whatsapp-card">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Businesses</h3>
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{businessCount}</div>
              <div className="flex items-center mt-1 text-xs">
                <span className="text-muted-foreground">{businessLimit - businessCount} remaining on your plan</span>
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="whatsapp-card">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="text-sm font-medium">Subscription</h3>
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{subscriptionName}</div>
              <div className="flex items-center mt-1 text-xs">
                {userData.subscription.isActive ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 text-yellow-500 mr-1" />
                )}
                <span className={userData.subscription.isActive ? "text-green-500" : "text-yellow-500"}>
                  {userData.subscription.isActive ? "Active" : "Pending"}
                </span>
              </div>
            </ResponsiveCard>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <ResponsiveCard className="col-span-4 whatsapp-card">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Recent Businesses</h3>
                <p className="text-sm text-muted-foreground">Your recently created business accounts</p>
              </div>
              <div className="space-y-4">
                {businesses.slice(0, 3).map((business) => (
                  <div key={business.id} className="flex items-center justify-between border-b pb-4">
                    <div>
                      <p className="font-medium">{business.name}</p>
                      <p className="text-sm text-muted-foreground">Created on {business.created}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          business.status === "active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : business.status === "pending"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                        }
                      >
                        {business.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/business/${business.id}/details`)}
                        className="text-primary hover:text-primary/80 hover:bg-primary/5"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full border-primary/20 text-primary hover:bg-primary/5"
                  onClick={() => router.push("/dashboard/business")}
                >
                  View All Businesses
                </Button>
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="col-span-3 whatsapp-card">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Subscription Usage</h3>
                <p className="text-sm text-muted-foreground">Your current plan usage</p>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Businesses</span>
                    <span>
                      <span className="font-medium">{businessCount}</span>/{businessLimit}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${businessPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Phone Numbers</span>
                    <span>
                      <span className="font-medium">{phoneNumberCount}</span>/{phoneNumberLimit}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${phoneNumberPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Messages</span>
                    <span>
                      <span className="font-medium">{messageCount.toLocaleString()}</span>/
                      {messageLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out"
                      style={{ width: `${messagePercentage}%` }}
                    ></div>
                  </div>
                </div>

                <Button
                  className="w-full mt-6 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  variant="outline"
                  onClick={() => router.push("/dashboard/subscription")}
                >
                  Manage Subscription <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </ResponsiveCard>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <ResponsiveCard className="whatsapp-card">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <p className="text-sm text-muted-foreground">Common tasks you might want to perform</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center justify-center"
                  onClick={() => router.push("/dashboard/business/new")}
                >
                  <Briefcase className="h-5 w-5 mb-2" />
                  <span>New Business</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center justify-center"
                  onClick={() => router.push("/dashboard/whatsapp/new")}
                >
                  <MessageSquare className="h-5 w-5 mb-2" />
                  <span>New WhatsApp</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center justify-center"
                  onClick={() => router.push("/dashboard/api-usage")}
                >
                  <BarChart className="h-5 w-5 mb-2" />
                  <span>View API Usage</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center justify-center"
                  onClick={() => router.push("/dashboard/docs")}
                >
                  <AlertCircle className="h-5 w-5 mb-2" />
                  <span>Documentation</span>
                </Button>
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="whatsapp-card">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Recent Activity</h3>
                <p className="text-sm text-muted-foreground">Your latest actions and notifications</p>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                    <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Message sent to +1234567890</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(Date.now() - i * 3600000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ResponsiveCard>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <ResponsiveCard>
            <div className="h-[400px] flex items-center justify-center bg-muted/5 rounded-md">
              <div className="text-center">
                <BarChart className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium">Analytics Dashboard</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Detailed analytics and reporting will be available here. Track your WhatsApp Business performance
                  metrics.
                </p>
              </div>
            </div>
          </ResponsiveCard>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ResponsiveCard>
            <div className="h-[400px] flex items-center justify-center bg-muted/5 rounded-md">
              <div className="text-center">
                <BarChart className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium">Reports Dashboard</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Custom reports and exports will be available here. Generate insights from your WhatsApp Business data.
                </p>
              </div>
            </div>
          </ResponsiveCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
