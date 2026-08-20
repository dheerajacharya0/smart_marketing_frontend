import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { MessageCircle } from "lucide-react"

export default function ChatPage() {
  return (
    <div className="container mx-auto p-6 h-full flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">WhatsApp Chat</CardTitle>
          <CardDescription>Connect with businesses using WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-success-soft rounded-full flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-success" />
          </div>
          <p className="text-muted-foreground">
            Select a conversation from the sidebar or start a new chat to begin messaging.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild>
            <Link href="/dashboard/chat/new">Start New Chat</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
