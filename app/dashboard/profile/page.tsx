"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CreditCard, User, Lock, Bell, Shield, CheckCircle2 } from "lucide-react"

export default function ProfilePage() {
  const [user, setUser] = useState({
    name: "John Doe",
    email: "john@example.com",
    role: "Super Admin",
    avatar: "/placeholder.svg?height=100&width=100",
    subscription: {
      tier: "premium",
      isActive: true,
      expiresAt: "2023-12-31",
    },
  })

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 whatsapp-card">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24 border-4 border-primary/10">
              <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {user.name.charAt(0)}
                {user.name.split(" ")[1]?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="text-xl font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge className="mt-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                {user.role}
              </Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full border-primary/20 text-primary hover:bg-primary/5">
              Change Avatar
            </Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2 whatsapp-card">
          <Tabs defaultValue="general" className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Account Settings</CardTitle>
                <TabsList className="bg-muted/50 border">
                  <TabsTrigger value="general">
                    <User className="h-4 w-4 mr-2" />
                    General
                  </TabsTrigger>
                  <TabsTrigger value="security">
                    <Lock className="h-4 w-4 mr-2" />
                    Security
                  </TabsTrigger>
                  <TabsTrigger value="notifications">
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </TabsTrigger>
                </TabsList>
              </div>
              <CardDescription>Update your account preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <TabsContent value="general" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" defaultValue={user.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" defaultValue={user.email} type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" defaultValue="Acme Inc" />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </TabsContent>
              <TabsContent value="security" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button>Update Password</Button>
                </div>
              </TabsContent>
              <TabsContent value="notifications" className="mt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Email Notifications</h4>
                      <p className="text-sm text-muted-foreground">Receive email notifications</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        Enable All
                      </Button>
                      <Button variant="outline" size="sm">
                        Disable All
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {["Account updates", "New messages", "Subscription alerts", "Security alerts"].map((item) => (
                      <div key={item} className="flex items-center justify-between">
                        <span>{item}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Enabled
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <Card className="whatsapp-card">
        <CardHeader className="flex flex-row items-center">
          <div className="flex-1">
            <CardTitle>Subscription Details</CardTitle>
            <CardDescription>Manage your subscription and billing</CardDescription>
          </div>
          <CreditCard className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Current Plan</h4>
              <p className="font-medium">Premium</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Billing Cycle</h4>
              <p className="font-medium">Monthly</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Next Billing Date</h4>
              <p className="font-medium">December 31, 2023</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Payment Method</h4>
              <p className="font-medium">Visa ending in 4242</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Billing Address</h4>
              <p className="font-medium">123 Business St, Suite 100</p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <div className="flex items-center">
                <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
            <Shield className="h-4 w-4 mr-2" />
            Update Payment Method
          </Button>
          <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
            <CreditCard className="h-4 w-4 mr-2" />
            View Billing History
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
