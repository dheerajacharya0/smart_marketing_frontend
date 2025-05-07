import Link from "next/link"
import { ArrowRight, CheckCircle, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

export default function GrantPermissionsPage({ params }: { params: { wabaId: string } }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Grant Permissions via OAuth</h2>
        <p className="text-muted-foreground">
          Allow the necessary permissions to integrate with WhatsApp Business API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Required Permissions</CardTitle>
          <CardDescription>
            The following permissions are required to set up and use the WhatsApp Business API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 border rounded-md">
              <Checkbox id="whatsapp_business_management" checked />
              <label htmlFor="whatsapp_business_management" className="text-sm font-medium">
                WhatsApp Business Management
              </label>
              <Shield className="ml-auto h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-md">
              <Checkbox id="whatsapp_business_messaging" checked />
              <label htmlFor="whatsapp_business_messaging" className="text-sm font-medium">
                WhatsApp Business Messaging
              </label>
              <Shield className="ml-auto h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-md">
              <Checkbox id="business_management" checked />
              <label htmlFor="business_management" className="text-sm font-medium">
                Business Management
              </label>
              <Shield className="ml-auto h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-md">
              <Checkbox id="pages_messaging" checked />
              <label htmlFor="pages_messaging" className="text-sm font-medium">
                Pages Messaging
              </label>
              <Shield className="ml-auto h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex justify-center p-4">
            <Button className="w-full sm:w-auto">
              <CheckCircle className="mr-2 h-4 w-4" /> Grant Permissions
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            These permissions allow our application to manage your WhatsApp Business account, send and receive messages,
            and handle business information.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-4`}>
            Continue to Business Manager <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
