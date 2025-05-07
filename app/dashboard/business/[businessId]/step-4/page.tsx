import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function BusinessManagerPage({ params }: { params: { businessId: string } }) {
  const businessManagers = [
    { id: "1", name: "Acme Inc. Business", isDefault: true },
    { id: "2", name: "Personal Business" },
    { id: "3", name: "Side Project LLC" },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select Business Manager</CardTitle>
          <CardDescription>Choose an existing Business Manager or create a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <p>
              A Business Manager is required to set up your WhatsApp Business API. It helps you organize and manage your
              business assets.
            </p>
          </div>

          <RadioGroup defaultValue="1">
            {businessManagers.map((manager) => (
              <div key={manager.id} className="flex items-center space-x-2 border p-4 rounded-lg">
                <RadioGroupItem value={manager.id} id={`manager-${manager.id}`} />
                <Label htmlFor={`manager-${manager.id}`} className="flex-1 cursor-pointer">
                  <div className="font-medium">{manager.name}</div>
                  {manager.isDefault && <div className="text-sm text-gray-500">Default Business Manager</div>}
                </Label>
              </div>
            ))}

            <div className="flex items-center space-x-2 border p-4 rounded-lg border-dashed">
              <RadioGroupItem value="new" id="manager-new" />
              <Label htmlFor="manager-new" className="flex-1 cursor-pointer">
                <div className="font-medium flex items-center">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Business Manager
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-5`}>Continue</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
