"use client"

import { useState, useEffect } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Check,
  MessageSquare,
  Phone,
  Plus,
  Loader2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  getWhatsappBusinessAccount,
  getWhatsappConversationalAutomation,
  updateWhatsappConversationalAutomation,
} from "@/services/api"
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
  const phoneDetails = accountSummary ?? null
  const phoneNumber = phoneDetails?.display_phone_number || ""
  const displayName = phoneDetails?.verified_name || ""

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Confirmation</h2>
        <p className="text-muted-foreground">Your WhatsApp Business account has been successfully connected!</p>
      </div>

      <Card className="border-success/25 bg-success-soft">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Check className="h-6 w-6 text-success" />
            <CardTitle>Integration Successful</CardTitle>
          </div>
          <CardDescription>
            Your WhatsApp Business API is now ready to use. Here's a summary of your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <Label>Phone Number</Label>
            <div className="flex items-center space-x-2 p-2 border rounded-md bg-white">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{phoneNumber || "—"}</span>
            </div>
          </div>

          <div className="grid gap-3">
            <Label>Verified Display Name</Label>
            <div className="flex items-center space-x-2 p-2 border rounded-md bg-white">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span>{displayName || "—"}</span>
            </div>
          </div>

          {phoneDetails && (
            <div className="grid gap-3">
              <Label>Number Status</Label>
              <div className="flex items-center justify-between gap-3 flex-wrap p-2 border rounded-md bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={
                      phoneDetails.code_verification_status === "VERIFIED" ? "bg-primary" : ""
                    }
                    variant={phoneDetails.code_verification_status === "VERIFIED" ? "default" : "outline"}
                  >
                    {phoneDetails.code_verification_status || "UNKNOWN"}
                  </Badge>
                  {phoneDetails.quality_rating && (
                    <Badge variant="outline">Quality: {phoneDetails.quality_rating}</Badge>
                  )}
                </div>
                {phoneDetails.code_verification_status !== "VERIFIED" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/whatsapp/${unwrappedParams.wabaId}/step-2`}>
                      Verify / Update Number
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>Create, edit, and submit templates for this account, with optional AI drafting.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/dashboard/whatsapp/${unwrappedParams.wabaId}/templates?wabaId=${wabaId}`}>
              Manage Templates <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Start Messaging</CardTitle>
          <CardDescription>Choose how you want to start using WhatsApp Business API.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chat">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat">Live Chat</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-4 pt-4">
              <p className="text-sm">Start chatting with your customers directly through our dashboard.</p>
              <Button asChild>
                <Link href="/dashboard/chat">Open Chat Dashboard</Link>
              </Button>
            </TabsContent>

            <TabsContent value="automation" className="space-y-4 pt-4">
              <p className="text-sm">
                Configure the welcome message, ice breakers, and slash-commands customers see when they open a chat
                with you on WhatsApp.
              </p>

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

                  <Button onClick={handleSaveAutomation} disabled={isSavingAutomation} className="w-full">
                    {isSavingAutomation ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Automation Settings"
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/whatsapp">
            Go to WhatsApp Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
