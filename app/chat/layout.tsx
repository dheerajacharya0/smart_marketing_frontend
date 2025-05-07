import type { ReactNode } from "react"
import { ChatSidebar } from "@/components/chat-sidebar"

export default function ChatLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      <ChatSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
