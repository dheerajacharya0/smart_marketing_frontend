"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ChatSidebar } from "@/components/chat-sidebar"

/**
 * Inbox shell.
 *
 * Two panes on a desktop, one at a time below that. A conversation list and an
 * open thread side by side at 390px gives neither enough room to be usable, so
 * below `lg` the list *is* the page at `/dashboard/chat` and the thread takes
 * the whole screen once one is open — the thread header carries the back link.
 *
 * The split used to start at `md`. At 768px the dashboard's own sidebar is
 * still expanded, so the 320px list left the thread pane about 150px wide and
 * its empty state was squeezed to one word per line. Pane widths here have to
 * be read against that sidebar, not the viewport.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const threadOpen = pathname !== "/dashboard/chat"

  return (
    <div className="flex h-full min-h-0">
      <aside className={threadOpen ? "hidden lg:flex lg:shrink-0" : "flex w-full lg:w-auto lg:shrink-0"}>
        <ChatSidebar />
      </aside>
      <main
        className={
          threadOpen
            ? "min-w-0 flex-1 overflow-hidden"
            : "hidden min-w-0 flex-1 overflow-hidden lg:block"
        }
      >
        {children}
      </main>
    </div>
  )
}
