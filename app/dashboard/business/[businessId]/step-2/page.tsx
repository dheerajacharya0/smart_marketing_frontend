"use client"

import { CardFooter } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Facebook } from "lucide-react"

export default function BusinessVerificationPage({ params }: { params: { businessId: string } }) {
  const router = useRouter()
  // const [verificationMethod, setVerificationMethod] = useState("document")
  // const [isSubmitting, setIsSubmitting] = useState(false)
  // const [businessName, setBusinessName] = useState("")
  // const [businessType, setBusinessType] = useState("")
  // const [businessAddress, setBusinessAddress] = useState("")
  // const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("")

  // const handleSubmit = () => {
  //   setIsSubmitting(true)

  //   // Simulate API call
  //   setTimeout(() => {
  //     setIsSubmitting(false)
  //     router.push(`/dashboard/business/${params.businessId}/step-3`)
  //   }, 1500)
  // }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Login with Facebook</CardTitle>
          <CardDescription>
            Connect your Facebook account to continue with the WhatsApp Business API setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            <p>
              You'll need a Facebook account with admin access to a Facebook Business Manager account. If you don't have
              one, we'll help you create it in the next steps.
            </p>
          </div>

          <div className="flex justify-center">
            <img src="/placeholder.svg?height=200&width=200" alt="Facebook Login" className="rounded-lg border p-2" />
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>We'll only request the permissions needed for WhatsApp Business API integration.</p>
            <p>Your Facebook login credentials are never stored on our servers.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button size="lg" className="bg-[#1877F2] hover:bg-[#166FE5]" asChild>
            <Link href={`/dashboard/business/${params.businessId}/step-3`}>
              <Facebook className="mr-2 h-5 w-5" />
              Continue with Facebook
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
