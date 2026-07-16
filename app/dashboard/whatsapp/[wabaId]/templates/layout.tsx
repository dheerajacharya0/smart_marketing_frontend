import type React from "react"
import { Card } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Message Templates</h2>
          <p className="text-muted-foreground mt-2">
            Create, edit, and submit WhatsApp message templates for this account.
          </p>
        </div>
        <BackButton />
      </div>

      <Card className="p-6">{children}</Card>
    </div>
  )
}
