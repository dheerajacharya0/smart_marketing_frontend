"use client"

import type React from "react"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { TemplatesBackProvider, useTemplatesBackOverride } from "./back-context"

function TemplatesBackButton() {
  const ctx = useTemplatesBackOverride()
  return <BackButton onClick={ctx?.override ?? undefined} />
}

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return (
    <TemplatesBackProvider>
      <div className="space-y-6">
        <div>
          <TemplatesBackButton />
        </div>
        <PageHeader
          title="Message templates"
          description="Create, preview and submit the WhatsApp templates this account sends."
        />
        {/* No card around the page: the templates are cards themselves, and a
            frame around a grid of frames read as a box of boxes. */}
        {children}
      </div>
    </TemplatesBackProvider>
  )
}
