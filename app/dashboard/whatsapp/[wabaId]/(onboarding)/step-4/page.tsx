"use client"

import { useState, useEffect } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Check,
  FileText,
  MessageSquare,
  Phone,
  Plus,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Pill, SectionTitle, StepCard, StepFooter } from "@/components/onboarding/onboarding-ui"
import { ONBOARDING_STEPS } from "@/components/whatsapp-integration-stepper"
import {
  getWhatsappBusinessAccount,
  getWhatsappConversationalAutomation,
  updateWhatsappConversationalAutomation,
} from "@/services/api"
import { useWhatsappPhoneNumbers } from "@/hooks/use-queries"
import { confirmedNumber } from "@/lib/confirmed-number"
import { toast } from "react-hot-toast"
import React from "react"

type CommandDraft = {
  commandName: string
  commandDescription: string
}

const MAX_PROMPTS = 4
const MAX_COMMANDS = 30

interface PhoneDetails {
  display_phone_number?: string
  verified_name?: string
  code_verification_status?: string
  quality_rating?: string
  [key: string]: unknown
}

export default function ConfirmationPage({ params }: { params: Promise<{ wabaId: string }> }) {
  return (
    <React.Suspense fallback={null}>
      <ConfirmationContent params={params} />
    </React.Suspense>
  )
}

function ConfirmationContent({ params }: { params: Promise<{ wabaId: string }> }) {
  const unwrappedParams = React.use(params)
  const searchParams = useSearchParams()
  const wabaId = searchParams.get("wabaId") || ""
  const phoneNumberId = searchParams.get("phoneNumberId") || ""

  const [welcomeMessageEnabled, setWelcomeMessageEnabled] = useState(false)
  const [prompts, setPrompts] = useState<string[]>([])
  const [commands, setCommands] = useState<CommandDraft[]>([])
  const [isSavingAutomation, setIsSavingAutomation] = useState(false)

  // The registered number, read back from Meta rather than from our copy — this
  // is the confirmation page, so it should show what Meta actually has.
  const { data: accountSummary } = useQuery({
    queryKey: ["whatsapp-business-account", unwrappedParams.wabaId, wabaId],
    queryFn: async () => {
      const { data } = await getWhatsappBusinessAccount(unwrappedParams.wabaId)
      const account = Array.isArray(data) ? data.find((w) => w.id === wabaId) : undefined
      return (account?.details as PhoneDetails | undefined) ?? null
    },
    enabled: Boolean(unwrappedParams.wabaId && wabaId),
  })
  // Meta's list covers only WABAs owned by the business picked in step 1, and
  // gives each WABA's first number. A number from another business (or not the
  // first in its WABA) isn't there, so fall back to our own row for it.
  const { data: ourNumbers } = useWhatsappPhoneNumbers(unwrappedParams.wabaId)
  const {
    details: phoneDetails,
    phoneNumber,
    displayName,
  } = confirmedNumber(phoneNumberId, accountSummary, ourNumbers)

  const { data: automation, isLoading: isLoadingAutomation } = useQuery({
    queryKey: ["conversational-automation", unwrappedParams.wabaId, phoneNumberId],
    queryFn: () => getWhatsappConversationalAutomation(unwrappedParams.wabaId, phoneNumberId),
    enabled: Boolean(unwrappedParams.wabaId && phoneNumberId),
  })

  // Seed the editable copies once the saved settings arrive. Keyed on the
  // response so a refetch can't overwrite prompts someone is typing.
  useEffect(() => {
    if (!automation) return
    setWelcomeMessageEnabled(!!automation.enableWelcomeMessage)
    setPrompts(Array.isArray(automation.prompts) ? automation.prompts : [])
    setCommands(Array.isArray(automation.commands) ? automation.commands : [])
  }, [automation])

  const addPrompt = () => {
    if (prompts.length >= MAX_PROMPTS) {
      toast.error(`Max ${MAX_PROMPTS} ice breakers`)
      return
    }
    setPrompts([...prompts, ""])
  }

  const updatePrompt = (index: number, value: string) => {
    setPrompts(prompts.map((p, i) => (i === index ? value : p)))
  }

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index))
  }

  const addCommand = () => {
    if (commands.length >= MAX_COMMANDS) {
      toast.error(`Max ${MAX_COMMANDS} commands`)
      return
    }
    setCommands([...commands, { commandName: "", commandDescription: "" }])
  }

  const updateCommand = (index: number, patch: Partial<CommandDraft>) => {
    setCommands(commands.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  const removeCommand = (index: number) => {
    setCommands(commands.filter((_, i) => i !== index))
  }

  const handleSaveAutomation = async () => {
    if (prompts.some((p) => !p.trim())) {
      toast.error("Ice breaker text can't be empty")
      return
    }
    if (commands.some((c) => !c.commandName.trim() || !c.commandDescription.trim())) {
      toast.error("Commands need both a name and a description")
      return
    }
    setIsSavingAutomation(true)
    try {
      await updateWhatsappConversationalAutomation({
        accountId: unwrappedParams.wabaId,
        phoneNumberId,
        enableWelcomeMessage: welcomeMessageEnabled,
        prompts,
        commands,
      })
      toast.success("Automation settings saved")
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to save automation settings")
    } finally {
      setIsSavingAutomation(false)
    }
  }

  const verified = phoneDetails?.code_verification_status === "VERIFIED"

  return (
    <div className="space-y-6">
      <StepCard className="overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col items-center gap-3 bg-success-soft/60 px-6 pb-6 pt-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground shadow-md">
            <Check className="h-8 w-8" strokeWidth={3} />
          </span>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-success">
              Step {ONBOARDING_STEPS.length} of {ONBOARDING_STEPS.length}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">You&apos;re all set</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Your WhatsApp number is connected and ready to send and receive messages.
            </p>
          </div>
        </div>

        <dl className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <SummaryItem icon={<Phone className="h-4 w-4" />} label="Phone number" value={phoneNumber || "—"} />
          <SummaryItem icon={<MessageSquare className="h-4 w-4" />} label="Display name" value={displayName || "—"} />
        </dl>

        {phoneDetails ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={verified ? "success" : "warning"}>
                {verified ? "Verified" : humanizeStatus(phoneDetails.code_verification_status) || "Status unknown"}
              </Pill>
              {phoneDetails.quality_rating ? (
                <Pill tone="muted">Quality: {humanizeStatus(phoneDetails.quality_rating)}</Pill>
              ) : null}
            </div>
            {!verified && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-2`}>Verify or update number</Link>
              </Button>
            )}
          </div>
        ) : null}
      </StepCard>

      <div className="space-y-3">
        <h3 className="font-semibold">What&apos;s next</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <NextStep
            href="/dashboard/chat"
            icon={<MessageSquare className="h-5 w-5" />}
            title="Open your inbox"
            description="Reply to customers as their messages arrive."
          />
          <NextStep
            href={`/dashboard/whatsapp/${unwrappedParams.wabaId}/templates?wabaId=${wabaId}`}
            icon={<FileText className="h-5 w-5" />}
            title="Create a template"
            description="Needed to message customers first. AI drafting included."
          />
          <NextStep
            href="#chat-automation"
            icon={<Sparkles className="h-5 w-5" />}
            title="Set up a welcome"
            description="Greeting, ice breakers and quick commands."
          />
        </div>
      </div>

      <StepCard className="scroll-mt-24">
        <div id="chat-automation" className="scroll-mt-24">
          <SectionTitle
            title="Chat automation"
            description="What customers see when they open a chat with you on WhatsApp. Optional — you can change it any time."
          />
              {!phoneNumberId ? (
                <p className="text-sm text-destructive">
                  Missing phone number ID in the URL — go back to step 2 and reselect your number before configuring
                  automation.
                </p>
              ) : isLoadingAutomation ? (
                <div className="flex items-center py-4">
                  <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading automation settings...
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium text-sm">Welcome Message</p>
                      <p className="text-xs text-muted-foreground">
                        Send an automatic greeting the first time a customer messages you.
                      </p>
                    </div>
                    <Switch checked={welcomeMessageEnabled} onCheckedChange={setWelcomeMessageEnabled} />
                  </div>

                  <div className="space-y-2 p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <Label>Ice Breakers ({prompts.length}/{MAX_PROMPTS})</Label>
                      <Button variant="outline" size="sm" onClick={addPrompt} disabled={prompts.length >= MAX_PROMPTS}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Prompt
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Suggested first messages shown to new customers before they've said anything.
                    </p>
                    {prompts.map((prompt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={prompt}
                          onChange={(e) => updatePrompt(i, e.target.value)}
                          placeholder="e.g. Track my order"
                          maxLength={80}
                        />
                        <Button variant="ghost" size="sm" onClick={() => removePrompt(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <Label>Commands ({commands.length}/{MAX_COMMANDS})</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCommand}
                        disabled={commands.length >= MAX_COMMANDS}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Command
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Slash-commands customers can pick when they type "/" in the chat.
                    </p>
                    {commands.map((command, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={command.commandName}
                          onChange={(e) => updateCommand(i, { commandName: e.target.value })}
                          placeholder="track_order"
                          className="w-40"
                        />
                        <Input
                          value={command.commandDescription}
                          onChange={(e) => updateCommand(i, { commandDescription: e.target.value })}
                          placeholder="Track your order status"
                          className="flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeCommand(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="soft"
                      onClick={handleSaveAutomation}
                      disabled={isSavingAutomation}
                      className="w-full sm:w-auto"
                    >
                      {isSavingAutomation ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                        </>
                      ) : (
                        "Save chat automation"
                      )}
                    </Button>
                  </div>
                </div>
              )}
        </div>
      </StepCard>

      <StepFooter>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/whatsapp">
            Done <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </StepFooter>
    </div>
  )
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{value}</dd>
      </div>
    </div>
  )
}

function NextStep({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all duration-base ease-out-soft hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>
      <span className="space-y-1">
        <span className="flex items-center gap-1 font-medium">
          {title}
          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </Link>
  )
}

/** Meta's SNAKE_CASE values as words: NOT_VERIFIED → "Not verified". */
function humanizeStatus(value: string | undefined): string | null {
  if (!value) return null
  const words = value.toLowerCase().split("_").join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
