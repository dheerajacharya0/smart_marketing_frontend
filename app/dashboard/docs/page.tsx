import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, FileText, ExternalLink, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function DocsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Documentation</h1>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documentation" className="pl-8" />
        </div>
      </div>

      <Tabs defaultValue="guides" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="api">API Reference</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="guides" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Essential guides to get you up and running</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: "WhatsApp Business API Overview",
                    description: "Learn about the WhatsApp Business API and its capabilities",
                    link: "#",
                  },
                  {
                    title: "Setting Up Your First WABA",
                    description: "Step-by-step guide to create your first WhatsApp Business Account",
                    link: "#",
                  },
                  {
                    title: "Message Templates Guide",
                    description: "How to create and use message templates effectively",
                    link: "#",
                  },
                  {
                    title: "Webhook Integration",
                    description: "Set up webhooks to receive real-time updates",
                    link: "#",
                  },
                ].map((guide, index) => (
                  <Card key={index} className="border">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{guide.title}</CardTitle>
                      <CardDescription className="text-xs">{guide.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <Link href={guide.link}>
                          <FileText className="h-4 w-4 mr-2" />
                          Read Guide
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Topics</CardTitle>
              <CardDescription>Detailed guides for advanced users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "Multi-User Access Management",
                    description: "Learn how to manage access for multiple users and roles",
                    link: "#",
                  },
                  {
                    title: "Advanced Message Templating",
                    description: "Create dynamic and interactive message templates",
                    link: "#",
                  },
                  {
                    title: "Optimizing API Usage",
                    description: "Best practices for efficient API usage and rate limit management",
                    link: "#",
                  },
                ].map((topic, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-medium">{topic.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                      <Button variant="link" size="sm" className="p-0 h-auto mt-2" asChild>
                        <Link href={topic.link}>
                          Read More
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Reference</CardTitle>
              <CardDescription>Complete reference for the WhatsApp Business API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      title: "Messages API",
                      description: "Send and receive messages",
                      endpoints: ["POST /messages", "GET /messages/{id}"],
                    },
                    {
                      title: "Templates API",
                      description: "Manage message templates",
                      endpoints: ["GET /templates", "POST /templates", "DELETE /templates/{id}"],
                    },
                    {
                      title: "Media API",
                      description: "Upload and manage media files",
                      endpoints: ["POST /media", "GET /media/{id}"],
                    },
                    {
                      title: "Contacts API",
                      description: "Manage contacts and contact lists",
                      endpoints: ["GET /contacts", "POST /contacts"],
                    },
                  ].map((api, index) => (
                    <Card key={index} className="border">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{api.title}</CardTitle>
                        <CardDescription className="text-xs">{api.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2">
                          {api.endpoints.map((endpoint, i) => (
                            <div key={i} className="text-xs font-mono bg-muted p-1 rounded">
                              {endpoint}
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-3">
                          View Documentation
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium">API Authentication</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    All API requests require authentication using an API key. You can generate API keys in your account
                    settings.
                  </p>
                  <div className="bg-muted p-2 rounded mt-2 text-xs font-mono">Authorization: Bearer YOUR_API_KEY</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Documentation</CardTitle>
              <CardDescription>Learn how to receive and process webhook events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium">Webhook Setup</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure your webhook URL in the settings page to receive real-time updates about messages and
                    status changes.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href="/dashboard/settings">Configure Webhooks</Link>
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Webhook Events</h3>
                  <div className="border rounded-md divide-y">
                    <div className="grid grid-cols-3 p-4 font-medium">
                      <div>Event Type</div>
                      <div>Description</div>
                      <div>Example Payload</div>
                    </div>
                    {[
                      {
                        type: "message",
                        description: "Triggered when a message is received",
                        payload: '{ "type": "message", "from": "+1234567890", ... }',
                      },
                      {
                        type: "status",
                        description: "Triggered when message status changes",
                        payload: '{ "type": "status", "id": "msg123", "status": "delivered" }',
                      },
                      {
                        type: "template_status",
                        description: "Triggered when template status changes",
                        payload: '{ "type": "template_status", "id": "123", "status": "approved" }',
                      },
                    ].map((event, index) => (
                      <div key={index} className="grid grid-cols-3 p-4">
                        <div className="font-mono text-xs">{event.type}</div>
                        <div className="text-sm">{event.description}</div>
                        <div className="font-mono text-xs bg-muted p-1 rounded">{event.payload}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium">Webhook Security</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Webhook requests are signed with a signature in the X-Hub-Signature header. Verify this signature to
                    ensure the webhook is authentic.
                  </p>
                  <div className="bg-muted p-2 rounded mt-2 text-xs font-mono">
                    {`// Example verification code (Node.js)
const crypto = require('crypto');
const isValidSignature = (payload, signature, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return signature === digest;
};`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Common questions and answers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    question: "How long does WABA verification take?",
                    answer:
                      "WhatsApp Business Account verification typically takes 1-3 business days, but can sometimes take longer depending on the information provided and current processing times.",
                  },
                  {
                    question: "What are the message template guidelines?",
                    answer:
                      "Message templates must comply with WhatsApp's Business Policy. They should not contain promotional content unless the user has opted in, and must not include any content related to illegal activities, adult content, or weapons.",
                  },
                  {
                    question: "How do I increase my message limit?",
                    answer:
                      "Message limits are based on your Quality Rating and the number of unique customers you message. Maintain a high Quality Rating by ensuring low block rates and high response rates.",
                  },
                  {
                    question: "What happens if I exceed my API rate limit?",
                    answer:
                      "If you exceed your API rate limit, requests will be rejected with a 429 Too Many Requests error until the rate limit window resets. Consider implementing exponential backoff in your application.",
                  },
                  {
                    question: "Can I use the same phone number for multiple WABAs?",
                    answer:
                      "No, a phone number can only be associated with one WhatsApp Business Account at a time. You'll need separate phone numbers for each WABA.",
                  },
                ].map((faq, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-medium">{faq.question}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
