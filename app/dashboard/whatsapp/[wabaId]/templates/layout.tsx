import type React from "react"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Message templates"
        description="Create, preview and submit the WhatsApp templates this account sends."
        actions={<BackButton />}
      />
      {/* No card around the page: the templates are cards themselves, and a
          frame around a grid of frames read as a box of boxes. */}
      {children}
    </div>
  )
}
