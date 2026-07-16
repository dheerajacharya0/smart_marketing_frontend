"use client"
import { usePathname } from "next/navigation"
import { Check, CircleDashed, CircleDot } from "lucide-react"

export function WhatsAppIntegrationStepper({ wabaId }: { wabaId: string }) {
  const pathname = usePathname()

  const steps = [
    {
      id: 1,
      name: "Business",
      path: `/dashboard/whatsapp/${wabaId}/step-1`,
    },
    {
      id: 2,
      name: "WhatsApp Number",
      path: `/dashboard/whatsapp/${wabaId}/step-2`,
    },
    {
      id: 3,
      name: "Activate",
      path: `/dashboard/whatsapp/${wabaId}/step-3`,
    },
    {
      id: 4,
      name: "Confirmation",
      path: `/dashboard/whatsapp/${wabaId}/step-4`,
    },
  ]

  const getCurrentStepIndex = () => {
    const currentStep = pathname.split("/").pop()
    if (!currentStep) return 0

    const stepNumber = Number.parseInt(currentStep.replace("step-", ""))
    return stepNumber - 1
  }

  const currentStepIndex = getCurrentStepIndex()

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center relative w-full">
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  index < currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : index === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index < currentStepIndex ? (
                  <Check className="h-5 w-5" />
                ) : index === currentStepIndex ? (
                  <CircleDot className="h-5 w-5" />
                ) : (
                  <CircleDashed className="h-5 w-5" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`h-1 w-full ${index < currentStepIndex ? "bg-primary" : "bg-muted"}`}></div>
              )}
            </div>
            <span className={`text-sm mt-2 ${index === currentStepIndex ? "font-medium" : "text-muted-foreground"}`}>
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
