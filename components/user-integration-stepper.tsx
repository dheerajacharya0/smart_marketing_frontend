"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Circle, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Cookies from "js-cookie"
import { useEffect, useState } from "react"

const steps = [
  { id: "step-1", title: "Start Integration" },
  { id: "step-2", title: "Login with Facebook" },
  { id: "step-3", title: "Grant Permissions" },
  { id: "step-4", title: "Business Manager" },
  { id: "step-5", title: "WhatsApp Business Account" },
  { id: "step-6", title: "Phone Verification" },
  { id: "step-7", title: "Business Display Name" },
  { id: "step-8", title: "Receive IDs & Token" },
  { id: "step-9", title: "Setup Webhooks" },
  { id: "step-10", title: "Business Verification" },
  { id: "step-11", title: "Test API" },
]

export default function UserIntegrationStepper({ userId }: { userId: string }) {
  const pathname = usePathname()
  const currentStepId = pathname.split("/").pop() || ""
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId)

  const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1].id : null
  const nextStep = currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1].id : null

  // State to hold user details
  const [userDetails, setUserDetails] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Get the user cookie (assuming it's JSON stringified)
    const userCookie = Cookies.get("user")
    if (userCookie) {
      try {
        setUserDetails(JSON.parse(userCookie))
      } catch (e) {
        // handle error
        setUserDetails(null)
      }
    }
  }, [])

  // Redirect based on whatsappBusinessDetails
  useEffect(() => {
    if (userDetails) {
      if (userDetails.whatsappBusinessDetails === null) {
        router.replace(`/dashboard/user/${userId}/step-4`)
      } else if (userDetails.whatsappBusinessDetails) {
        router.replace(`/dashboard/user/${userId}/step-5`)
      }
    }
  }, [userDetails, userId, router])

  return (
    <div className="space-y-4">
      {/* <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">WhatsApp Business Integration</h1>
        <div className="flex space-x-2">
          {prevStep && (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/user/${userId}/${prevStep}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Link>
            </Button>
          )}
          {nextStep && (
            <Button asChild>
              <Link href={`/dashboard/user/${userId}/${nextStep}`}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center">
            <Link
              href={`/dashboard/user/${userId}/${step.id}`}
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                index < currentStepIndex
                  ? "bg-green-100 text-green-600"
                  : index === currentStepIndex
                    ? "bg-blue-100 text-blue-600 ring-2 ring-blue-600"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {index < currentStepIndex ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
            </Link>
            {index < steps.length - 1 && (
              <div className={`w-full h-0.5 mt-4 ${index < currentStepIndex ? "bg-green-600" : "bg-gray-200"}`} />
            )}
            <span
              className={`text-xs mt-2 text-center ${
                index === currentStepIndex ? "font-medium text-blue-600" : "text-gray-500"
              }`}
            >
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile stepper */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-sm text-gray-500">{steps[currentStepIndex]?.title}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div> */}
    </div>
  )
}
