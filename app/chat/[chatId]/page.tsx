"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Paperclip, Smile, MoreVertical, Phone, Video } from "lucide-react"

// Mock data for the selected chat
const MOCK_CHATS = {
  "1": {
    id: "1",
    name: "Business Support",
    avatar: "/placeholder.svg?height=40&width=40",
    online: true,
    messages: [
      {
        id: "1",
        content: "Hello! How can I help you today?",
        sender: "them",
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: "2",
        content: "I have a question about my recent order.",
        sender: "me",
        timestamp: new Date(Date.now() - 3500000),
      },
      {
        id: "3",
        content: "Of course! Could you please provide your order number?",
        sender: "them",
        timestamp: new Date(Date.now() - 3400000),
      },
    ],
  },
  "2": {
    id: "2",
    name: "Order Updates",
    avatar: "/placeholder.svg?height=40&width=40",
    online: false,
    messages: [
      {
        id: "1",
        content: "Your order #12345 has been shipped!",
        sender: "them",
        timestamp: new Date(Date.now() - 86400000),
      },
      {
        id: "2",
        content: "Great! When can I expect delivery?",
        sender: "me",
        timestamp: new Date(Date.now() - 85000000),
      },
      {
        id: "3",
        content: "It should arrive within 2-3 business days.",
        sender: "them",
        timestamp: new Date(Date.now() - 84000000),
      },
    ],
  },
  "3": {
    id: "3",
    name: "Promotions",
    avatar: "/placeholder.svg?height=40&width=40",
    online: false,
    messages: [
      {
        id: "1",
        content: "Check out our new summer collection! 🌞",
        sender: "them",
        timestamp: new Date(Date.now() - 172800000),
      },
      {
        id: "2",
        content: "Use code SUMMER20 for 20% off your next purchase.",
        sender: "them",
        timestamp: new Date(Date.now() - 172700000),
      },
    ],
  },
}

export default function ChatDetailPage({ params }: { params: { chatId: string } }) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Array<{ id: string; content: string; sender: string; timestamp: Date }>>([])
  const [chat, setChat] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // In a real app, you would fetch this data from an API
    const selectedChat = MOCK_CHATS[params.chatId as keyof typeof MOCK_CHATS]
    if (selectedChat) {
      setChat(selectedChat)
      setMessages(selectedChat.messages)
    }
  }, [params.chatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    if (!message.trim()) return

    const newMessage = {
      id: Date.now().toString(),
      content: message,
      sender: "me",
      timestamp: new Date(),
    }

    setMessages([...messages, newMessage])
    setMessage("")

    // Simulate a reply after a short delay
    setTimeout(() => {
      const reply = {
        id: (Date.now() + 1).toString(),
        content: "Thanks for your message! I'll get back to you shortly.",
        sender: "them",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, reply])
    }, 1000)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  if (!chat) {
    return <div className="flex items-center justify-center h-full">Chat not found</div>
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Chat header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={chat.avatar || "/placeholder.svg"} alt={chat.name} />
            <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium">{chat.name}</h2>
            <p className="text-xs text-gray-500">{chat.online ? "Online" : "Offline"}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
              {msg.sender !== "me" && (
                <Avatar className="h-8 w-8 mr-2 mt-1">
                  <AvatarImage src={chat.avatar || "/placeholder.svg"} alt={chat.name} />
                  <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}

              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  msg.sender === "me" ? "bg-green-500 text-white" : "bg-white border"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <div className={`text-xs mt-1 text-right ${msg.sender === "me" ? "text-green-100" : "text-gray-400"}`}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message input */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            size="icon"
            className="bg-green-500 hover:bg-green-600"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
