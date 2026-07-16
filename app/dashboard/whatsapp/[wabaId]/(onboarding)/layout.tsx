import type React from "react"
import { WhatsAppIntegrationStepper } from "@/components/whatsapp-integration-stepper"
import { Card } from "@/components/ui/card"

export default async function WhatsAppIntegrationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ wabaId: string }>
}) {
  const { wabaId } = await params
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">WhatsApp Business Integration</h2>
        <p className="text-muted-foreground mt-2">
          Follow the steps below to complete your WhatsApp Business API setup.
        </p>
      </div>

      <WhatsAppIntegrationStepper wabaId={wabaId} />

      <Card className="p-6">{children}</Card>
    </div>
  )
}
