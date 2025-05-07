import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Check, MessageSquare, Users, Store, Bell } from "lucide-react"

export default function GrantPermissionsPage({ params }: { params: { userId: string } }) {
  const permissions = [
    {
      icon: MessageSquare,
      title: "WhatsApp Business Management",
      description: "Manage your WhatsApp Business accounts and messaging",
    },
    {
      icon: Users,
      title: "Business Manager Access",
      description: "Access and manage your Business Manager accounts",
    },
    {
      icon: Store,
      title: "Business Assets",
      description: "Manage business assets like accounts and catalogs",
    },
    {
      icon: Bell,
      title: "Webhook Notifications",
      description: "Receive webhook notifications for message events",
    },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Grant Permissions</CardTitle>
          <CardDescription>
            The following permissions are required to set up your WhatsApp Business API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
            <p>
              These permissions allow our application to set up and manage your WhatsApp Business account on your
              behalf.
            </p>
          </div>

          <div className="space-y-4">
            {permissions.map((permission, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="bg-blue-100 p-2 rounded-full">
                  <permission.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{permission.title}</h3>
                  <p className="text-sm text-gray-500">{permission.description}</p>
                </div>
                <Check className="h-5 w-5 text-green-500" />
              </div>
            ))}
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>You can revoke these permissions at any time from your Facebook account settings.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/user/${params.userId}/step-4`}>Grant Permissions</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
