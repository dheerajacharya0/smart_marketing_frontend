"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button"
import { TokenHealthBanners } from "@/components/token-health-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, MessageSquare } from "lucide-react"
import { QualityBadge, messagingTierLabel } from "@/components/quality-badge"
import {
  getFacebookAccounts,
  type FacebookAccount,
  getCurrentUser,
  getUserDataFromCookie,
  listWhatsappPhoneNumbers,
  syncBusiness,
  getWhatsappBusinessAccount,
} from "@/services/api"

// // Mock data for WhatsApp Business accounts
// const accounts = [
//   {
//     id: "waba1",
//     name: "Acme Inc",
//     phoneNumber: "+1 (555) 123-4567",
//     status: "verified",
//     createdAt: "2023-04-12",
//     messagesPerDay: 1250,
//   },
//   {
//     id: "waba2",
//     name: "XYZ Corp",
//     phoneNumber: "+1 (555) 987-6543",
//     status: "pending",
//     createdAt: "2023-04-10",
//     messagesPerDay: 850,
//   },
//   {
//     id: "waba3",
//     name: "ABC Ltd",
//     phoneNumber: "+1 (555) 456-7890",
//     status: "verified",
//     createdAt: "2023-04-08",
//     messagesPerDay: 2100,
//   },
//   {
//     id: "waba4",
//     name: "Tech Solutions",
//     phoneNumber: "+1 (555) 789-0123",
//     status: "in_progress",
//     createdAt: "2023-04-05",
//     messagesPerDay: 450,
//   },
// ]

// A Facebook account enriched with its registered number's health details for
// the list view (built in fetchFacebookAccounts).
interface EnrichedAccount extends Omit<FacebookAccount, "whatsappBusinessDetails"> {
  phoneNumber?: string | null
  whatsappBusinessDetails?: {
    phoneNumber?: string | null
    wabaId?: string
    phoneNumberId?: string
    createdAt?: string
    qualityRating?: string | null
    messagingTier?: string | null
    qualityUpdatedAt?: string | null
  } | null
}

export default function WhatsAppBusinessPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [facebookAccounts, setFacebookAccounts] = useState<EnrichedAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadAccounts = useCallback(async () => {
    {
      try {
        const user = getUserDataFromCookie()
        if (user?.id) {
          const accountsList = await getFacebookAccounts(user.id)
          const facebookAccounts = (accountsList || []).filter((a) => a.type === "facebook")
          const enriched = await Promise.all(
            facebookAccounts.map(async (account) => {
              try {
                // Refresh our DB copy from Meta first — display name/number on
                // the phone number record can be stale/null if it was never
                // synced after registration.
                await syncBusiness(account.id).catch(() => {})
                const numbers = await listWhatsappPhoneNumbers(account.id)
                const registered = (numbers || []).find((n) => n.status === "registered")
                if (registered) {
                  let phoneNumber = registered.displayPhoneNumber
                  // Our DB copy can be stale/never-synced (null) — fall back to a
                  // live Meta lookup, same call step-4's confirmation page uses
                  // successfully to show the real number.
                  if (!phoneNumber) {
                    try {
                      const wabaRes = await getWhatsappBusinessAccount(account.id)
                      const wabaList = wabaRes?.data
                      const waba = (wabaList || []).find((w) => w.id === registered.wabaId)
                      phoneNumber = waba?.details?.display_phone_number || null
                    } catch (err) {
                      console.log("live waba lookup err", account.id, err)
                    }
                  }
                  return {
                    ...account,
                    whatsappBusinessDetails: {
                      phoneNumber,
                      wabaId: registered.wabaId,
                      phoneNumberId: registered.phoneNumberId,
                      createdAt: registered.createdAt,
                      qualityRating: registered.qualityRating ?? null,
                      messagingTier: registered.messagingTier ?? null,
                      qualityUpdatedAt: registered.qualityUpdatedAt ?? null,
                    },
                  }
                }
              } catch (err) {
                console.log("phone numbers fetch err", account.id, err)
              }
              return account
            }),
          )
          setFacebookAccounts(enriched)
        }
      } catch (err) {
        console.log("err", err)
        // handle error
      } finally {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // Filter accounts based on search term
  const filteredAccounts = facebookAccounts.filter((account) => {
    return (
      account?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account?.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-primary">Verified</Badge>
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "in_progress":
        return <Badge variant="secondary">In Progress</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">WhatsApp Business</h2>
        <div className="flex flex-wrap gap-2">
          <ConnectWhatsAppButton label="Connect WhatsApp" onSuccess={() => loadAccounts()} />
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/whatsapp/new")}
          >
            <Plus className="mr-2 h-4 w-4" /> New Integration
          </Button>
        </div>
      </div>

      {/* Feature 2 — token-health re-link prompts */}
      <TokenHealthBanners accounts={facebookAccounts} onReconnected={() => loadAccounts()} />

      <Card className="whatsapp-card">
        <CardHeader>
          <CardTitle>WhatsApp Business Accounts</CardTitle>
          <CardDescription>Manage your WhatsApp Business API integrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
            <div className="grid w-full md:w-2/3 items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search accounts..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Daily Limit</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-sm text-muted-foreground">Loading accounts...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No WhatsApp Business accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account?.name}</TableCell>
                      <TableCell>{account?.whatsappBusinessDetails?.phoneNumber || "N/A"}</TableCell>
                      <TableCell>{getStatusBadge(account?.status || "N/A")}</TableCell>
                      <TableCell>
                        {account?.whatsappBusinessDetails ? (
                          <QualityBadge
                            rating={account.whatsappBusinessDetails.qualityRating}
                            updatedAt={account.whatsappBusinessDetails.qualityUpdatedAt}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {messagingTierLabel(account?.whatsappBusinessDetails?.messagingTier) ? (
                          <Badge variant="outline">
                            {messagingTierLabel(account?.whatsappBusinessDetails?.messagingTier)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account?.whatsappBusinessDetails?.createdAt
                          ? new Date(account.whatsappBusinessDetails.createdAt).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                if (account.status === "verified") {
                                  const query = new URLSearchParams({
                                    wabaId: account.whatsappBusinessDetails?.wabaId || "",
                                    phoneNumberId: account.whatsappBusinessDetails?.phoneNumberId || "",
                                  })
                                  router.push(`/dashboard/whatsapp/${account.id}/step-4?${query.toString()}`)
                                } else {
                                  router.push(`/dashboard/whatsapp/${account.id}/step-1`)
                                }
                              }}
                            >
                              {account.status === "verified" ? "View Setup" : "Continue Setup"}
                            </DropdownMenuItem>
                            {account.whatsappBusinessDetails ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const query = new URLSearchParams({
                                      wabaId: account.whatsappBusinessDetails?.wabaId || "",
                                    })
                                    router.push(`/dashboard/whatsapp/${account.id}/templates?${query.toString()}`)
                                  }}
                                >
                                  Manage Templates
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/whatsapp/${account.id}/details`)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/whatsapp/${account.id}/edit`)}>
                                  Edit Account
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            <DropdownMenuItem className="text-red-600">Delete Account</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && filteredAccounts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-accent p-3 mb-3">
                <MessageSquare className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No WhatsApp Business accounts found</h3>
              <p className="text-sm text-muted-foreground mt-1">Get started by creating a new WhatsApp integration</p>
              <Button
                className="mt-4 bg-primary hover:bg-primary/90"
                onClick={() => router.push("/dashboard/whatsapp/new")}
              >
                <Plus className="mr-2 h-4 w-4" /> New Integration
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
