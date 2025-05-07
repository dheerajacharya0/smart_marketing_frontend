import Link from "next/link"
import { ArrowRight, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import React from "react"
import { getFacebookLoginUrl } from "@/services/api"
import FacebookCodeHandlerWrapper from "./FacebookCodeHandlerWrapper"

export default async function FacebookLoginPage({ params }: { params: { wabaId: string } }) {
  const facebookLoginUrl = await getFacebookLoginUrl();
  return (
    <div className="space-y-6">
      <FacebookCodeHandlerWrapper />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Login with Facebook</h2>
        <p className="text-muted-foreground">Connect your Facebook account to access the WhatsApp Business API.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facebook Authentication</CardTitle>
          <CardDescription>
            You need to authenticate with Facebook to access the WhatsApp Business Platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">Why Facebook Login?</h3>
            <p className="text-sm text-muted-foreground">
              WhatsApp Business API is managed through Facebook Business Manager. Logging in with Facebook allows you to
              access your Business Manager account and create or manage your WhatsApp Business Account.
            </p>
          </div>

          <div className="flex flex-col items-center space-y-4 p-6 border rounded-lg bg-muted/50">
            <Facebook className="h-12 w-12 text-blue-600" />
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href={facebookLoginUrl}>Continue with Facebook</a>
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              By continuing, you agree to Facebook's Terms of Service and acknowledge you have read the Privacy Policy.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link href={`/dashboard/whatsapp/${params.wabaId}/step-3`}>
            Continue to Permissions <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
