"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, User } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SettingsPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [webhookNotifications, setWebhookNotifications] = useState(true)
  const [apiRateLimiting, setApiRateLimiting] = useState(true)
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)

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
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">Team</p>
            <p className="text-sm text-muted-foreground">Manage members and their roles for this account.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/team">Manage team</Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="api">API Settings</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-10 w-10 text-gray-400" />
                  </div>
                  <div>
                    <Button variant="outline" size="sm">
                      Change Avatar
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, GIF or PNG. Max size 1MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="Super Admin" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" defaultValue="admin@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input id="title" defaultValue="System Administrator" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" defaultValue="+1 (555) 123-4567" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      rows={4}
                      defaultValue="Super admin responsible for managing WhatsApp Business API integrations and user accounts."
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Notifications</p>
                    <p className="text-sm text-muted-foreground">Master toggle for all notification types</p>
                  </div>
                  <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Notification Channels</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                      disabled={!notificationsEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Webhook Notifications</p>
                      <p className="text-xs text-muted-foreground">Send notifications to webhook endpoints</p>
                    </div>
                    <Switch
                      checked={webhookNotifications}
                      onCheckedChange={setWebhookNotifications}
                      disabled={!notificationsEnabled}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Notification Events</h3>
                  <div className="space-y-2">
                    {[
                      "New user registration",
                      "WABA verification status changes",
                      "Template approval status changes",
                      "API rate limit warnings",
                      "System maintenance alerts",
                    ].map((event, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <p className="text-sm">{event}</p>
                        <Switch defaultChecked disabled={!notificationsEnabled} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input id="current-password" type="password" />
                    </div>
                    <div></div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input id="new-password" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input id="confirm-password" type="password" />
                    </div>
                  </div>
                  <Button variant="outline">Change Password</Button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    </div>
                    <Switch checked={twoFactorAuth} onCheckedChange={setTwoFactorAuth} />
                  </div>
                  {twoFactorAuth && (
                    <div className="border rounded-md p-4">
                      <p className="text-sm">Two-factor authentication is enabled.</p>
                      <div className="mt-2 flex space-x-2">
                        <Button variant="outline" size="sm">
                          Setup Authenticator App
                        </Button>
                        <Button variant="outline" size="sm">
                          Generate Backup Codes
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Session Management</h3>
                  <div className="border rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Current Session</p>
                        <p className="text-xs text-muted-foreground">Started: Today at 10:23 AM • Chrome on Windows</p>
                      </div>
                      <Badge className="bg-green-500">Active</Badge>
                    </div>
                  </div>
                  <Button variant="outline">Sign Out All Other Sessions</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
              <CardDescription>Manage API access and rate limits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">API Rate Limiting</p>
                    <p className="text-sm text-muted-foreground">Limit the number of API requests per minute</p>
                  </div>
                  <Switch checked={apiRateLimiting} onCheckedChange={setApiRateLimiting} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Rate Limit Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="rate-limit">Default Rate Limit (requests/minute)</Label>
                      <Input id="rate-limit" type="number" defaultValue="60" disabled={!apiRateLimiting} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="burst-limit">Burst Limit (requests/second)</Label>
                      <Input id="burst-limit" type="number" defaultValue="10" disabled={!apiRateLimiting} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">API Keys</h3>
                  <div className="border rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Primary API Key</p>
                        <p className="text-xs text-muted-foreground">Created: Jan 15, 2023 • Last used: Today</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Regenerate
                      </Button>
                    </div>
                    <div className="mt-2 bg-muted p-2 rounded-md font-mono text-xs">
                      sk_live_*************************************
                    </div>
                  </div>
                  <Button variant="outline">Create New API Key</Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Webhook Settings</h3>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Global Webhook URL</Label>
                    <Input id="webhook-url" defaultValue="https://api.example.com/webhooks/whatsapp" />
                    <p className="text-xs text-muted-foreground">
                      This URL will receive all webhook events unless overridden by individual WABA settings
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret">Webhook Secret</Label>
                    <Input id="webhook-secret" defaultValue="whsec_*************************************" />
                    <p className="text-xs text-muted-foreground">Used to verify webhook signatures</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure global system settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Regional Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Default Timezone</Label>
                      <Select defaultValue="UTC">
                        <SelectTrigger id="timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date-format">Date Format</Label>
                      <Select defaultValue="MM/DD/YYYY">
                        <SelectTrigger id="date-format">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">System Maintenance</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Automatic Updates</p>
                        <p className="text-xs text-muted-foreground">Automatically apply system updates</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Error Reporting</p>
                        <p className="text-xs text-muted-foreground">
                          Send anonymous error reports to improve the system
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Backup & Restore</h3>
                  <div className="flex space-x-2">
                    <Button variant="outline">Export System Data</Button>
                    <Button variant="outline">Import System Data</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Last backup: Yesterday at 11:30 PM</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Danger Zone</h3>
                  <div className="border border-red-200 rounded-md p-4 bg-red-50">
                    <p className="text-sm font-medium text-red-600">Reset System</p>
                    <p className="text-xs text-red-600 mt-1">
                      This will reset all system settings to their default values. This action cannot be undone.
                    </p>
                    <Button variant="destructive" size="sm" className="mt-2">
                      Reset System
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Badge component for the security tab
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`px-2 py-1 text-xs font-medium rounded-full text-white ${className}`}>{children}</span>
}
