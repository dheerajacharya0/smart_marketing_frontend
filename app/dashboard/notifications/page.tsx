"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, CheckCircle, AlertTriangle, Info, X } from "lucide-react"

// Mock data for notifications
const INITIAL_NOTIFICATIONS = [
  {
    id: "1",
    title: "New user registered",
    description: "John Doe has registered a new account.",
    type: "info",
    read: false,
    date: "Just now",
  },
  {
    id: "2",
    title: "WABA verification completed",
    description: "Acme Support WABA has been verified successfully.",
    type: "success",
    read: false,
    date: "5 minutes ago",
  },
  {
    id: "3",
    title: "Template rejected",
    description: "The 'Promotional Offer' template was rejected. Please review and resubmit.",
    type: "error",
    read: false,
    date: "1 hour ago",
  },
  {
    id: "4",
    title: "API rate limit warning",
    description: "Acme Marketing is approaching its API rate limit (85% used).",
    type: "warning",
    read: true,
    date: "3 hours ago",
  },
  {
    id: "5",
    title: "System maintenance scheduled",
    description: "System maintenance is scheduled for tomorrow at 2:00 AM UTC.",
    type: "info",
    read: true,
    date: "Yesterday",
  },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const [activeTab, setActiveTab] = useState("all")

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "all") return true
    if (activeTab === "unread") return !notification.read
    return notification.type === activeTab
  })

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    )
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map((notification) => ({ ...notification, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter((notification) => notification.id !== id))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <X className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length

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
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <div className="ml-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">
              {unreadCount}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
          Mark All as Read
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="success">Success</TabsTrigger>
          <TabsTrigger value="warning">Warnings</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Notifications</CardTitle>
              <CardDescription>
                {activeTab === "all"
                  ? "All system notifications"
                  : activeTab === "unread"
                    ? "Unread notifications"
                    : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} notifications`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredNotifications.length > 0 ? (
                <div className="space-y-4">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start space-x-4 p-4 rounded-lg border ${
                        notification.read ? "bg-white" : "bg-blue-50"
                      }`}
                    >
                      <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{notification.title}</h3>
                          <span className="text-xs text-muted-foreground">{notification.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-8 px-2 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark as read
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-lg">No notifications</h3>
                  <p className="text-muted-foreground">
                    {activeTab === "all"
                      ? "You don't have any notifications yet."
                      : activeTab === "unread"
                        ? "You've read all your notifications."
                        : `You don't have any ${activeTab} notifications.`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/settings">
                    <Bell className="h-4 w-4 mr-2" />
                    Manage Notification Preferences
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
