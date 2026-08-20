import type { ReactNode } from "react"
import { ChatSidebar } from "@/components/chat-sidebar"

export default function ChatLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex h-full bg-muted">
      <ChatSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
