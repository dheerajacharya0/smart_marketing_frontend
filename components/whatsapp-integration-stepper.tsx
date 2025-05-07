"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import React from "react"

import { cn } from "@/lib/utils"

// Update the steps array to include step-8 for API Credentials
const steps = [
  { id: 1, name: "Overview", path: "step-1" },
  { id: 2, name: "Facebook Login", path: "step-2" },
  { id: 3, name: "Business Setup", path: "step-3" },
  { id: 4, name: "Phone Verification", path: "step-4" },
  { id: 5, name: "Business Verification", path: "step-5" },
  { id: 6, name: "Display Settings", path: "step-6" },
  { id: 7, name: "Message Templates", path: "step-7" },
  { id: 8, name: "API Credentials", path: "step-8" },
  { id: 9, name: "Webhooks", path: "step-9" },
]

export function WhatsAppIntegrationStepper({ wabaId }: { wabaId: string }) {
  const pathname = usePathname()
  const router = useRouter()

  // Redirect to step-4 if wabaId is not "waba1"
  React.useEffect(() => {
    if (wabaId && wabaId !== "waba1") {
      // Only redirect if not already on step-4
      // if (!pathname.endsWith("/step-4")) {
      //   router.replace(`/dashboard/whatsapp/${wabaId}/step-4`)
      // }
    }
  }, [wabaId, pathname, router])

  // Updated logic for currentStep
  const currentStep = 1
    // wabaId === "waba1"
    //   ? 1
      // : (!!wabaId && wabaId.length > 0
          // ? 4
          // : Number.parseInt(pathname.split("/").pop()?.split("-")[1] || "1"))

  return (
    <div className="w-full mb-8">
      <div className="hidden md:block">
        <div className="relative">
          {/* Progress bar */}
          <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-200">
            <div
              className="absolute top-0 h-0.5 bg-primary transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step) => {
              const isCompleted = step.id < currentStep
              const isCurrent = step.id === currentStep

              // Updated href logic to match the currentStep logic
              let href = `/dashboard/whatsapp/step-1`
              if (wabaId === "waba1") {
                href = `/dashboard/whatsapp/waba1/step-1`
              } else if (wabaId && wabaId.length > 0) {
                href = step.id === 4
                  ? `/dashboard/whatsapp/${wabaId}/step-4`
                  : `/dashboard/whatsapp/${wabaId}/${step.path}`
              }

              return (
                <div key={step.id} className="flex flex-col items-center">
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200",
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-white border-primary text-primary"
                          : "bg-white border-gray-300 text-gray-400",
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </Link>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium whitespace-nowrap",
                      isCurrent ? "text-primary" : "text-gray-500",
                    )}
                  >
                    {step.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile stepper */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-primary">
            {currentStep > 0 && currentStep <= steps.length ? steps[currentStep - 1].name : "Unknown Step"}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${(Math.min(currentStep, steps.length) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
