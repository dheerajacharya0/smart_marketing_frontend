"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Check, Clock, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function TestApiPage({ params }: { params: { userId: string } }) {
  const [message, setMessage] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [messages, setMessages] = useState<
    Array<{
      id: string
      content: string
      sender: "user" | "business"
      status?: "sent" | "delivered" | "read"
      timestamp: Date
    }>
  >([
    {
      id: "1",
      content: "Hello! This is a test message from the WhatsApp Business API.",
      sender: "business",
      status: "read",
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: "2",
      content: "I received your message. This is a customer reply.",
      sender: "user",
      timestamp: new Date(Date.now() - 1800000),
    },
  ])

  const [isSending, setIsSending] = useState(false)

  const handleSendMessage = () => {
    if (!message.trim()) return

    setIsSending(true)

    // Simulate sending a message
    setTimeout(() => {
      const newMessage = {
        id: Date.now().toString(),
        content: message,
        sender: "business" as const,
        status: "sent" as const,
        timestamp: new Date(),
      }

      setMessages([...messages, newMessage])
      setMessage("")
      setIsSending(false)

      // Simulate message being delivered
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === newMessage.id ? { ...msg, status: "delivered" as const } : msg)),
        )

        // Simulate message being read
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === newMessage.id ? { ...msg, status: "read" as const } : msg)),
          )

          // Simulate receiving a reply
          setTimeout(() => {
            const reply = {
              id: (Date.now() + 1).toString(),
              content: "Thanks for your message! This is an automated reply.",
              sender: "user" as const,
              timestamp: new Date(),
            }

            setMessages((prev) => [...prev, reply])
          }, 3000)
        }, 2000)
      }, 1500)
    }, 1000)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const getStatusIcon = (status?: "sent" | "delivered" | "read") => {
    switch (status) {
      case "sent":
        return <Clock className="h-3 w-3 text-gray-400" />
      case "delivered":
        return <Check className="h-3 w-3 text-gray-400" />
      case "read":
        return (
          <div className="flex">
            <Check className="h-3 w-3 text-blue-500" />
            <Check className="h-3 w-3 -ml-1 text-blue-500" />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Test WhatsApp API</CardTitle>
          <CardDescription>Send and receive test messages using the WhatsApp Business API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="send" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send">Send Message</TabsTrigger>
              <TabsTrigger value="templates">Message Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="space-y-4">
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter recipient phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Enter a phone number with country code (e.g., +1234567890)</p>
              </div>

              <div className="border rounded-lg h-80 overflow-y-auto p-4 bg-gray-50">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === "business" ? "justify-end" : "justify-start"}`}>
                      {msg.sender === "user" && (
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      )}

                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.sender === "business" ? "bg-blue-500 text-white" : "bg-white border"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <div
                          className={`text-xs mt-1 flex justify-end items-center space-x-1 ${
                            msg.sender === "business" ? "text-blue-100" : "text-gray-400"
                          }`}
                        >
                          <span>{formatTime(msg.timestamp)}</span>
                          {msg.sender === "business" && getStatusIcon(msg.status)}
                        </div>
                      </div>

                      {msg.sender === "business" && (
                        <Avatar className="h-8 w-8 ml-2">
                          <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Business" />
                          <AvatarFallback>B</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={isSending}
                />
                <Button onClick={handleSendMessage} disabled={!message.trim() || isSending}>
                  {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
                <p>
                  Message templates allow you to send structured messages to your customers. Templates need to be
                  approved before they can be used.
                </p>
              </div>

              <div className="space-y-4">
                <div className="border p-4 rounded-lg">
                  <h3 className="font-medium">Welcome Message</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Hello {"{{1}}"}, welcome to our service! We're excited to have you on board.
                  </p>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm">
                      Use Template
                    </Button>
                  </div>
                </div>

                <div className="border p-4 rounded-lg">
                  <h3 className="font-medium">Order Confirmation</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Your order #{"{{1}}"} has been confirmed and will be shipped on {"{{2}}"}. Thank you for your
                    purchase!
                  </p>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm">
                      Use Template
                    </Button>
                  </div>
                </div>

                <div className="border p-4 rounded-lg">
                  <h3 className="font-medium">Appointment Reminder</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    This is a reminder for your appointment on {"{{1}}"} at {"{{2}}"}. Reply YES to confirm or NO to
                    reschedule.
                  </p>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm">
                      Use Template
                    </Button>
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full">
                Create New Template
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/dashboard" className="flex items-center">
              Back to Dashboard
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard" className="flex items-center">
              Complete Setup
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
