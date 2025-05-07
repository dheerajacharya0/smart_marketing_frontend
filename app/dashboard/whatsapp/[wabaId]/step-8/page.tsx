import Link from "next/link"
import { ArrowRight, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function APICredentialsPage({ params }: { params: { wabaId: string } }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Receive WABA ID, Phone Number ID, API Token</h2>
        <p className="text-muted-foreground">Your WhatsApp Business API credentials for integration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Credentials</CardTitle>
          <CardDescription>
            Store these credentials securely. You'll need them to integrate with the WhatsApp Business API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waba-id">WhatsApp Business Account ID (WABA ID)</Label>
              <div className="flex">
                <Input id="waba-id" value="1234567890123456" readOnly className="flex-1 bg-muted" />
                <Button variant="outline" size="icon" className="ml-2">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone-id">Phone Number ID</Label>
              <div className="flex">
                <Input id="phone-id" value="9876543210987654" readOnly className="flex-1 bg-muted" />
                <Button variant="outline" size="icon" className="ml-2">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-token">API Token</Label>
              <div className="flex">
                <Input
                  id="api-token"
                  value="EAABZCqZAZCZCZCZC..."
                  type="password"
                  readOnly
                  className="flex-1 bg-muted"
                />
                <Button variant="outline" size="icon" className="ml-2">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This token is sensitive. Store it securely and never expose it in client-side code.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">How to use these credentials:</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
              <li>Store these values in your server environment variables</li>
              <li>Use the WABA ID to identify your WhatsApp Business Account</li>
              <li>Use the Phone Number ID in API requests to send messages</li>
              <li>Include the API Token in the Authorization header of your API requests</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-9`}>
            Continue to Webhooks Setup <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
