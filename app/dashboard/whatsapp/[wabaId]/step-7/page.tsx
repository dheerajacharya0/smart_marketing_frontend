import Link from "next/link"
import { ArrowRight, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function BusinessDisplayNamePage({ params }: { params: { wabaId: string } }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Enter Business Display Name</h2>
        <p className="text-muted-foreground">Set the display name for your WhatsApp Business Account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Display Name</CardTitle>
          <CardDescription>This name will be visible to your customers on WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input id="display-name" placeholder="Enter your business name" />
              <p className="text-xs text-muted-foreground">
                Your display name must match your business name and follow WhatsApp's naming guidelines.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-description">Business Description (Optional)</Label>
              <Textarea id="business-description" placeholder="Describe your business" />
              <p className="text-xs text-muted-foreground">
                A brief description of your business that helps customers understand your services.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-website">Business Website (Optional)</Label>
              <Input id="business-website" placeholder="https://www.example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-email">Business Email (Optional)</Label>
              <Input id="business-email" placeholder="contact@example.com" type="email" />
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Display Name Guidelines:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-muted-foreground">
              <li>Must match your business name</li>
              <li>Cannot include categories, locations, or taglines</li>
              <li>Cannot use all capital letters</li>
              <li>Cannot include emojis or special characters</li>
              <li>Subject to review by WhatsApp</li>
            </ul>
          </div>

          <Button className="w-full">
            <Building2 className="mr-2 h-4 w-4" /> Save Business Information
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-8`}>
            Continue to API Credentials <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
