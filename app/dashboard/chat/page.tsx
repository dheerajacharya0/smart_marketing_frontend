import Link from "next/link"
import { MessagesSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"

/**
 * The desktop resting state of the inbox: the list is on the left and nothing
 * is open yet. On a phone this route renders the list itself and this pane is
 * hidden, so this copy is written for someone who can see both.
 */
export default function ChatPage() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        doodle
        icon={MessagesSquare}
        title="Pick a conversation"
        description="Choose a thread on the left to read its history and reply. New messages arrive here in real time."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/chat/new">Start a new conversation</Link>
          </Button>
        }
        hint="You can reply freely for 24 hours after someone writes to you. After that, WhatsApp only allows an approved template."
      />
    </div>
  )
}
