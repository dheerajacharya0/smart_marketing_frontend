import type { ReactNode } from "react"
import UserIntegrationStepper from "@/components/user-integration-stepper"

export default function UserIntegrationLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { userId: string }
}) {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <UserIntegrationStepper userId={params.userId} />
      </div>
      {children}
    </div>
  )
}
