"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveCard } from "@/components/ui/responsive-card"
import { AlertCircle, ArrowRight, Briefcase, Plus, Search, X } from "lucide-react"
import { getBusinessesByOwnerId } from "@/lib/business-model"
import { getUserById } from "@/lib/user-model"

export default function BusinessPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")

  // In a real app, you would get the current user ID from authentication
  const userId = "1"
  const user = getUserById(userId)
  // Fix: Use getBusinessesByOwnerId instead of getBusinessesByUserId
  const allBusinesses = getBusinessesByOwnerId(userId)

  // Filter businesses based on search query and status
  const filteredBusinesses = allBusinesses.filter((business) => {
    const matchesSearch =
      business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.industry.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === "all" || business.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // Get subscription limits
  const maxBusinesses = user?.subscription?.limits?.maxBusinesses || 1
  const businessCount = allBusinesses.length
  const canCreateBusiness = businessCount < maxBusinesses

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Integration</h1>
          <p className="text-muted-foreground">Manage your WhatsApp Business integrations</p>
        </div>
        <Button onClick={() => router.push("/dashboard/business/new")} disabled={!canCreateBusiness}>
          <Plus className="mr-2 h-4 w-4" />
          New Business
        </Button>
      </div>

      {!canCreateBusiness && (
        <ResponsiveCard className="bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Subscription Limit Reached</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You've reached the maximum number of businesses ({maxBusinesses}) allowed on your current plan.
                <Link href="/dashboard/subscription" className="ml-1 font-medium underline">
                  Upgrade your subscription
                </Link>{" "}
                to add more businesses.
              </p>
            </div>
          </div>
        </ResponsiveCard>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-64 md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search businesses..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs defaultValue="all" className="w-full sm:w-auto" onValueChange={setFilterStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredBusinesses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBusinesses.map((business) => (
            <Card key={business.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>{business.name}</span>
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
                </CardTitle>
                <CardDescription>{business.industry}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{business.created}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone Numbers:</span>
                    <span>2</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Templates:</span>
                    <span>5</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/business/${business.id}/details`}>Details</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/business/${business.id}/step-1`}>
                    Continue Setup <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}

          {canCreateBusiness && (
            <Card className="border-dashed flex flex-col items-center justify-center text-center p-6">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-1">Add New Business</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {maxBusinesses - businessCount} remaining on your plan
              </p>
              <Button onClick={() => router.push("/dashboard/business/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New Business
              </Button>
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-10">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Briefcase className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No businesses found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchQuery
                ? `No businesses match your search "${searchQuery}". Try a different search term.`
                : "You haven't created any businesses yet. Create your first business to get started."}
            </p>
            {canCreateBusiness && (
              <Button onClick={() => router.push("/dashboard/business/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New Business
              </Button>
            )}
            {searchQuery && (
              <Button variant="outline" className="mt-2" onClick={() => setSearchQuery("")}>
                <X className="mr-2 h-4 w-4" />
                Clear Search
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
