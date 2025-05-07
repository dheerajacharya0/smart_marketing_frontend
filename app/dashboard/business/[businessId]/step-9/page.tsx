import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Code, ExternalLink } from "lucide-react"

export default function SetupWebhooksPage({ params }: { params: { businessId: string } }) {
  const webhookSteps = [
    {
      id: "step1",
      title: "Create Webhook Endpoint",
      description: "Create an HTTPS endpoint on your server to receive webhook events",
      code: "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/setup",
    },
    {
      id: "step2",
      title: "Configure Webhook URL",
      description: "Add your webhook URL and verify token in the Facebook Developer Portal",
      code: "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/configuration",
    },
    {
      id: "step3",
      title: "Subscribe to Webhook Events",
      description: "Select the events you want to receive notifications for",
      code: "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components",
    },
    {
      id: "step4",
      title: "Handle Webhook Events",
      description: "Implement handlers for different webhook event types",
      code: "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload",
    },
    {
      id: "step5",
      title: "Test Webhook Integration",
      description: "Send a test message to verify webhook events are being received",
      code: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      {/* <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Setup Webhooks & Backend Integration</CardTitle>
          <CardDescription>Configure webhooks to receive real-time updates from WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <p>
              Webhooks allow your application to receive real-time notifications when messages are sent, delivered,
              read, or when other events occur.
            </p>
          </div>

          <div className="space-y-4">
            {webhookSteps.map((step) => (
              <div key={step.id} className="flex space-x-4 border p-4 rounded-lg">
                <Checkbox id={step.id} />
                <div className="space-y-1 flex-1">
                  <Label htmlFor={step.id} className="font-medium cursor-pointer">
                    {step.title}
                  </Label>
                  <p className="text-sm text-gray-500">{step.description}</p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <a href={step.code} target="_blank" rel="noopener noreferrer">
                      <Code className="mr-2 h-4 w-4" />
                      View Documentation
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
            <p className="font-medium">Sample Webhook URL Format:</p>
            <code className="block p-2 mt-2 bg-amber-100 rounded text-sm overflow-x-auto">
              https://your-server.com/webhooks/whatsapp
            </code>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-10`}>Continue</Link>
          </Button>
        </CardFooter>
      </Card> */}
    </div>
  )
}
