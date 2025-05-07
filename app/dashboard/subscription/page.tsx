"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, AlertCircle, CreditCard } from "lucide-react"
import { getUserById } from "@/lib/user-model"
import { getSubscriptionPlan, getSubscriptionPlans } from "@/lib/subscription-plans"

// For demo purposes, we'll use a hardcoded user ID
const CURRENT_USER_ID = "user1"

export default function SubscriptionPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [isUpgrading, setIsUpgrading]: any = useState(false)

  // In a real app, you would get the current user from authentication
  const user = getUserById(CURRENT_USER_ID)
  const currentPlan = user ? getSubscriptionPlan(user.subscription.tier) : null
  const allPlans = getSubscriptionPlans()

  const handleUpgrade = (planId: string) => {
    setIsUpgrading(true)

    // Simulate API call to upgrade subscription
    setTimeout(() => {
      setIsUpgrading(false)
      // In a real app, you would redirect to a success page or show a success message
      alert(`Subscription upgraded to ${planId}`)
    }, 1500)
  }

  const getDiscountPercentage = (monthly: number, yearly: number) => {
    const yearlyMonthly = yearly / 12
    const discount = ((monthly - yearlyMonthly) / monthly) * 100
    return Math.round(discount)
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Subscription</h2>
        <p className="text-muted-foreground mt-1">Manage your subscription plan and billing</p>
      </div>

      {currentPlan && (
        <Alert className="bg-primary/5 border-primary/20">
          <CreditCard className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary font-medium">Current Plan: {currentPlan.name}</AlertTitle>
          <AlertDescription>
            You are currently on the {currentPlan.name} plan.
            {currentPlan.id === "enterprise"
              ? " This is our highest tier with unlimited access to all features."
              : " You can upgrade your plan to get access to more features and higher limits."}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList className="bg-background border">
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Choose a Plan</CardTitle>
                  <CardDescription>Select the plan that best fits your needs</CardDescription>
                </div>
                <div className="flex items-center space-x-2 bg-muted/50 p-1 rounded-lg">
                  <Button
                    variant={billingCycle === "monthly" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setBillingCycle("monthly")}
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={billingCycle === "yearly" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setBillingCycle("yearly")}
                  >
                    Yearly
                    <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">
                      Save up to 20%
                    </Badge>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {allPlans.map((plan) => {
                  const isCurrentPlan = currentPlan?.id === plan.id
                  const price = billingCycle === "monthly" ? plan.price.monthly : plan.price.yearly
                  const discount = getDiscountPercentage(plan.price.monthly, plan.price.yearly)

                  return (
                    <Card key={plan.id} className={`border ${isCurrentPlan ? "border-primary shadow-md" : ""}`}>
                      <CardHeader className="pb-3">
                        {isCurrentPlan && (
                          <Badge className="w-fit mb-2 bg-primary/10 text-primary border-primary/20">
                            Current Plan
                          </Badge>
                        )}
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex items-baseline mb-4">
                          <span className="text-3xl font-bold">${price}</span>
                          <span className="text-muted-foreground ml-1">/{billingCycle}</span>
                          {billingCycle === "yearly" && (
                            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                              Save {discount}%
                            </Badge>
                          )}
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-2 text-sm">
                          {plan.features.map((feature, index) => (
                            <div key={index} className="flex items-start">
                              <CheckCircle2 className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter>
                        {isCurrentPlan ? (
                          <Button variant="outline" className="w-full" disabled>
                            Current Plan
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={isUpgrading || (currentPlan && plan.id === "free" && currentPlan.id !== "free")}
                          >
                            {isUpgrading ? "Processing..." : `Upgrade to ${plan.name}`}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Comparison</CardTitle>
              <CardDescription>Compare features across different plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Feature</th>
                      {allPlans.map((plan) => (
                        <th key={plan.id} className="text-left py-3 px-4">
                          {plan.name}
                          {currentPlan?.id === plan.id && (
                            <Badge className="ml-2 bg-primary/10 text-primary border-primary/20">Current</Badge>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Business Accounts</td>
                      {allPlans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4">
                          {plan.businessLimit === -1 ? "Unlimited" : plan.businessLimit}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Monthly Messages</td>
                      {allPlans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4">
                          {plan.messageLimit === -1 ? "Unlimited" : plan.messageLimit.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">API Calls</td>
                      {allPlans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4">
                          {plan.apiLimit === -1 ? "Unlimited" : plan.apiLimit.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Templates</td>
                      {allPlans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4">
                          {plan.id === "free" ? "Basic" : plan.id === "basic" ? "Custom" : "Unlimited"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Analytics</td>
                      {allPlans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4">
                          {plan.id === "free" ? "Basic" : plan.id === "basic" ? "Basic" : "Advanced"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Support</td>
                      {allPlans.map((plan) => (
                        <td key={plan.id} className="py-3 px-4">
                          {plan.id === "free"
                            ? "Email"
                            : plan.id === "basic"
                              ? "Priority Email"
                              : plan.id === "premium"
                                ? "Priority Phone & Email"
                                : "Dedicated Account Manager"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Common questions about our subscription plans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  question: "Can I change my plan later?",
                  answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.",
                },
                {
                  question: "How does billing work?",
                  answer:
                    "We bill you at the start of each billing cycle. You can choose between monthly or yearly billing.",
                },
                {
                  question: "What happens if I exceed my plan limits?",
                  answer:
                    "If you exceed your plan limits, you'll be notified and given the option to upgrade. We don't automatically charge you for overages.",
                },
                {
                  question: "Can I get a refund?",
                  answer:
                    "We offer a 14-day money-back guarantee for all paid plans. Contact our support team for assistance.",
                },
              ].map((faq, index) => (
                <div key={index} className="space-y-1">
                  <h4 className="font-medium">{faq.question}</h4>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard/support">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Contact Support for More Questions
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View your past invoices and payment history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Description</th>
                      <th className="text-left py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        date: "Apr 1, 2023",
                        description: "Premium Plan - Monthly",
                        amount: "$79.00",
                        status: "Paid",
                      },
                      {
                        date: "Mar 1, 2023",
                        description: "Premium Plan - Monthly",
                        amount: "$79.00",
                        status: "Paid",
                      },
                      {
                        date: "Feb 1, 2023",
                        description: "Basic Plan - Monthly",
                        amount: "$29.00",
                        status: "Paid",
                      },
                      {
                        date: "Jan 1, 2023",
                        description: "Basic Plan - Monthly",
                        amount: "$29.00",
                        status: "Paid",
                      },
                    ].map((invoice, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-4">{invoice.date}</td>
                        <td className="py-3 px-4">{invoice.description}</td>
                        <td className="py-3 px-4">{invoice.amount}</td>
                        <td className="py-3 px-4">
                          <Badge className="bg-green-50 text-green-700 border-green-200">{invoice.status}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm">
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your payment methods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-primary/10 p-2 rounded-md">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Visa ending in 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                  </div>
                </div>
                <Badge>Default</Badge>
              </div>

              <Button className="w-full" variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
              <CardDescription>Manage your billing details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Billing Name</h4>
                  <p className="font-medium">John Doe</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Billing Email</h4>
                  <p className="font-medium">john@example.com</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Billing Address</h4>
                  <p className="font-medium">123 Business St, Suite 100</p>
                  <p className="font-medium">San Francisco, CA 94107</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Tax ID</h4>
                  <p className="font-medium">US123456789</p>
                </div>
              </div>

              <Button className="w-full" variant="outline">
                Update Billing Information
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
