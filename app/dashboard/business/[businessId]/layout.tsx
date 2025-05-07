import type { ReactNode } from "react"
import BusinessIntegrationStepper from "@/components/business-integration-stepper"

export default function BusinessIntegrationLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { businessId: string }
}) {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <BusinessIntegrationStepper businessId={params.businessId} />
      </div>
      {children}
    </div>
  )
}
