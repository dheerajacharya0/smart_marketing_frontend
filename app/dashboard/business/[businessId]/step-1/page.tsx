import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function StartIntegrationPage({ params }: { params: { businessId: string } }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to WhatsApp Business API Integration</CardTitle>
          <CardDescription>
            This wizard will guide you through the process of setting up your WhatsApp Business API account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <h3 className="font-medium mb-2">What you'll need:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Facebook account with admin access</li>
              <li>A business phone number that can receive SMS or calls</li>
              <li>Your business information</li>
              <li>A verified business</li>
            </ul>
          </div>
          <p>
            The integration process will take approximately 15-20 minutes to complete. Once finished, you'll be able to
            send and receive WhatsApp messages through our API.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-2`}>Start Integration</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
