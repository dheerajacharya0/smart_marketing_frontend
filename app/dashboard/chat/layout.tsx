"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ChatSidebar } from "@/components/chat-sidebar"

/**
 * Inbox shell.
 *
 * Two panes on a desktop, one at a time on a phone. A conversation list and an
 * open thread side by side at 390px gives neither enough room to be usable, so
 * below `md` the list *is* the page at `/dashboard/chat` and the thread takes
 * the whole screen once one is open — the thread header carries the back link.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const threadOpen = pathname !== "/dashboard/chat"

  return (
    <div className="flex h-full min-h-0">
      <aside className={threadOpen ? "hidden md:flex md:shrink-0" : "flex w-full md:w-auto md:shrink-0"}>
        <ChatSidebar />
      </aside>
      <main
        className={
          threadOpen
            ? "min-w-0 flex-1 overflow-hidden"
            : "hidden min-w-0 flex-1 overflow-hidden md:block"
        }
      >
        {children}
      </main>
    </div>
  )
}
