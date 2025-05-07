import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function WhatsAppBusinessAccountPage({ params }: { params: { businessId: string } }) {
  const wabaAccounts = [
    { id: "1", name: "Acme Support", status: "Active", number: "+1 (555) 123-4567" },
    { id: "2", name: "Acme Sales", status: "Pending Verification", number: "+1 (555) 987-6543" },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">WhatsApp Business Account</CardTitle>
          <CardDescription>Select an existing WhatsApp Business Account (WABA) or create a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <p>
              A WhatsApp Business Account allows you to use the WhatsApp Business API to send and receive messages at
              scale.
            </p>
          </div>

          <RadioGroup defaultValue="new">
            {wabaAccounts.map((account) => (
              <div key={account.id} className="flex items-center space-x-2 border p-4 rounded-lg">
                <RadioGroupItem value={account.id} id={`waba-${account.id}`} />
                <Label htmlFor={`waba-${account.id}`} className="flex-1 cursor-pointer">
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-gray-500">{account.number}</div>
                  <div className={`text-sm ${account.status === "Active" ? "text-green-600" : "text-amber-600"}`}>
                    {account.status}
                  </div>
                </Label>
              </div>
            ))}

            <div className="flex items-center space-x-2 border p-4 rounded-lg border-dashed">
              <RadioGroupItem value="new" id="waba-new" />
              <Label htmlFor="waba-new" className="flex-1 cursor-pointer">
                <div className="font-medium flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New WhatsApp Business Account
                </div>
                <div className="text-sm text-gray-500">You'll need to verify a phone number in the next step</div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-6`}>Continue</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
