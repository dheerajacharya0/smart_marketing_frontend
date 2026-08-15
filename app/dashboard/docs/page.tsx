import Link from "next/link"
import { ArrowLeft, ExternalLink, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"

/**
 * Documentation.
 *
 * Two tabs were removed here rather than restyled, because they documented a
 * product that does not exist:
 *
 * - **API Reference** described a customer-facing REST API (`POST /messages`,
 *   `GET /templates`, …) authenticated with `Authorization: Bearer YOUR_API_KEY`
 *   and told users to "generate API keys in your account settings". There is no
 *   public API for customers (it's P2, unbuilt) and no API-key concept anywhere
 *   in the codebase — `services/api.ts` has no such call.
 * - **Webhooks** told users to configure a webhook URL in settings and verify
 *   `X-Hub-Signature`. Webhooks run between the backend and Meta; they are not
 *   customer-configurable, and the settings screen it pointed at had only a
 *   hardcoded fake URL and a `whsec_***` secret.
 *
 * Both read as working integration surfaces. A non-functional "Search
 * documentation" box went with them. What's left is real: guides that link to
 * genuine destinations, and an accurate FAQ.
 */

interface Guide {
  title: string
  description: string
  href: string
  /** Off-site (Meta's own docs) — opens in a new tab. */
  external?: boolean
}

const GETTING_STARTED: Guide[] = [
  {
    title: "Glossary of WhatsApp terms",
    description: "WABA, quality rating, messaging tier, 24-hour window — in plain language",
    href: "/dashboard/glossary",
  },
  {
    title: "WhatsApp Business API overview",
    description: "What the WhatsApp Business Platform does and how it's structured",
    href: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    external: true,
  },
  {
    title: "Connect your WhatsApp account",
    description: "Link your Facebook Business Manager and register a number",
    href: "/dashboard/whatsapp",
  },
  {
    title: "Message templates",
    description: "How templates work, and why they're required to start a conversation",
    href: "https://developers.facebook.com/docs/whatsapp/message-templates",
    external: true,
  },
  {
    title: "Messaging limits & quality rating",
    description: "How many people you can message per day, and how that limit grows",
    href: "https://developers.facebook.com/docs/whatsapp/messaging-limits",
    external: true,
  },
]

const ADVANCED: Guide[] = [
  {
    title: "Team access & roles",
    description: "Invite teammates to your account and control what they can do",
    href: "/dashboard/settings/team",
  },
  {
    title: "Template formatting & variables",
    description: "Build templates with dynamic values filled in per contact",
    href: "https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates",
    external: true,
  },
]

const FAQS = [
  {
    question: "How long does WhatsApp Business Account verification take?",
    answer:
      "Usually 1-3 business days, though it can take longer depending on the information provided and Meta's current processing times.",
  },
  {
    question: "What are the message template guidelines?",
    answer:
      "Templates must comply with WhatsApp's Business Policy. They can't carry promotional content unless the recipient opted in, and can't reference illegal activity, adult content, or weapons.",
  },
  {
    question: "How do I increase my message limit?",
    answer:
      "Limits are based on your quality rating and how many unique people you message. Keep the rating healthy by sending to people who want to hear from you — low block rates and high response rates are what move it up.",
  },
  {
    question: "What happens when a campaign hits the daily limit?",
    answer:
      "It pauses and resumes automatically as the 24-hour window rolls forward. Nobody is dropped — remaining recipients stay queued, and the campaign shows 'Waiting on daily limit' until it can send again.",
  },
  {
    question: "My campaign says 'Needs a top-up' — what does that mean?",
    answer:
      "Your wallet ran out mid-send, so sending paused. Remaining recipients stay queued and nobody is dropped, but unlike the daily limit this one doesn't clear by waiting — top up your wallet on the Billing page and sending picks up on its own.",
  },
  {
    question: "Can I use the same phone number for multiple WhatsApp Business Accounts?",
    answer:
      "No. A phone number belongs to one WhatsApp Business Account at a time, so each account needs its own number.",
  },
]

function GuideLink({ guide, children }: { guide: Guide; children: React.ReactNode }) {
  if (guide.external) {
    // rel="noopener noreferrer" per the Phase S #5 convention for target="_blank".
    return (
      <a href={guide.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return <Link href={guide.href}>{children}</Link>
}

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <PageHeader
          title="Documentation"
          description="Guides for setting up and running WhatsApp messaging."
        />
      </div>

      <Tabs defaultValue="guides" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="guides" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
              <CardDescription>Essential guides to get you up and running</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {GETTING_STARTED.map((guide) => (
                  <Card key={guide.title} className="border">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">{guide.title}</CardTitle>
                      <CardDescription className="text-xs">{guide.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <GuideLink guide={guide}>
                          {guide.external ? (
                            <ExternalLink className="mr-2 h-4 w-4" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {guide.external ? "Read on Meta's docs" : "Open"}
                        </GuideLink>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Going further</CardTitle>
              <CardDescription>Once you&apos;ve sent your first messages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ADVANCED.map((topic) => (
                  <div
                    key={topic.title}
                    className="flex items-start space-x-4 rounded-lg border p-4"
                  >
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-medium">{topic.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
                      <Button variant="link" size="sm" className="mt-2 h-auto p-0" asChild>
                        <GuideLink guide={topic}>
                          {topic.external ? "Read on Meta's docs" : "Open"}
                          {topic.external && <ExternalLink className="ml-1 h-3 w-3" />}
                        </GuideLink>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Frequently asked questions</CardTitle>
              <CardDescription>Common questions and answers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {FAQS.map((faq) => (
                  <div key={faq.question} className="rounded-lg border p-4">
                    <h3 className="font-medium">{faq.question}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
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
