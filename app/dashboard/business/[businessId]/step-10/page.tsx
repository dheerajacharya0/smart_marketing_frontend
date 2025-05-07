import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function BusinessVerificationPage({ params }: { params: { businessId: string } }) {
  const verificationSteps = [
    {
      title: "Business Information Submitted",
      status: "complete",
      icon: CheckCircle2,
      description: "Your business information has been submitted successfully.",
    },
    {
      title: "Display Name Review",
      status: "in-progress",
      icon: Clock,
      description: "Your display name is being reviewed by the WhatsApp team.",
    },
    {
      title: "Business Verification",
      status: "pending",
      icon: AlertCircle,
      description: "Business verification will begin after display name approval.",
    },
  ]

  const statusColors = {
    complete: "text-green-600",
    "in-progress": "text-amber-600",
    pending: "text-gray-400",
  }

  const statusBgColors = {
    complete: "bg-green-100",
    "in-progress": "bg-amber-100",
    pending: "bg-gray-100",
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Business Verification & Display Name Review</CardTitle>
          <CardDescription>Track the status of your business verification and display name review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <p>
              Business verification and display name review are required steps to ensure the quality and legitimacy of
              businesses on WhatsApp.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-500">33% Complete</span>
            </div>
            <Progress value={33} className="h-2" />
          </div>

          <div className="space-y-4">
            {verificationSteps.map((step, index) => (
              <div key={index} className="border p-4 rounded-lg">
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-full ${statusBgColors[step.status as keyof typeof statusBgColors]}`}>
                    <step.icon className={`h-5 w-5 ${statusColors[step.status as keyof typeof statusColors]}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium flex items-center">
                      {step.title}
                      <span className={`ml-2 text-sm ${statusColors[step.status as keyof typeof statusColors]}`}>
                        (
                        {step.status === "complete"
                          ? "Completed"
                          : step.status === "in-progress"
                            ? "In Progress"
                            : "Pending"}
                        )
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{step.description}</p>

                    {step.status === "in-progress" && (
                      <div className="mt-2">
                        <div className="text-sm text-gray-500 flex justify-between mb-1">
                          <span>Estimated time remaining:</span>
                          <span>1-2 business days</span>
                        </div>
                        <Progress value={50} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
            <p className="font-medium">What happens next?</p>
            <p className="mt-2 text-sm">
              Once your display name is approved, your business verification will begin automatically. This process
              typically takes 1-3 business days. You'll receive email notifications about the status of your
              verification.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-11`}>Continue to Test API</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
