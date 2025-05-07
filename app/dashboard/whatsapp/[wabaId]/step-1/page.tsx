import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function IntegrationOverviewPage({ params }: { params: { wabaId: string } }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Welcome to WhatsApp Business API Integration</h2>
        <p className="text-muted-foreground">
          This wizard will guide you through setting up your WhatsApp Business API account.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">What is WhatsApp Business API?</h3>
          <p>
            The WhatsApp Business API allows medium and large businesses to communicate with customers at scale. It
            enables you to send notifications, provide customer service, and engage with your audience through WhatsApp
            messaging.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Integration Process</h3>
          <div className="grid gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                1
              </div>
              <div>
                <h4 className="font-medium">Facebook Login</h4>
                <p className="text-sm text-muted-foreground">
                  Connect with your Facebook account to access the WhatsApp Business API.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                2
              </div>
              <div>
                <h4 className="font-medium">Business Setup</h4>
                <p className="text-sm text-muted-foreground">
                  Set up your business profile and select or create a Business Manager account.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                3
              </div>
              <div>
                <h4 className="font-medium">Phone Verification</h4>
                <p className="text-sm text-muted-foreground">
                  Verify your business phone number via SMS or voice call.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                4
              </div>
              <div>
                <h4 className="font-medium">API Credentials</h4>
                <p className="text-sm text-muted-foreground">
                  Receive your API credentials to integrate WhatsApp with your systems.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                5
              </div>
              <div>
                <h4 className="font-medium">Test & Launch</h4>
                <p className="text-sm text-muted-foreground">
                  Test your integration and launch your WhatsApp Business solution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-2`}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
