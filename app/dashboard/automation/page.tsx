"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "react-hot-toast"
import {
  getUserDataFromCookie,
  getActiveWhatsappContext,
  listWhatsappPhoneNumbers,
  listWhatsappTemplates,
  createAutomationRule,
  listAutomationRules,
  updateAutomationRule,
  deleteAutomationRule,
  type AutomationRuleDetails,
} from "@/services/api"

type MatchType = AutomationRuleDetails["matchType"]
type ReplyType = AutomationRuleDetails["replyType"]

const EMPTY_FORM = {
  phoneNumberId: "",
  name: "",
  matchType: "contains" as MatchType,
  keywordsText: "",
  isActive: true,
  replyType: "text" as ReplyType,
  replyText: "",
  replyTemplateName: "",
  replyTemplateLanguage: "",
  priority: 0,
}

export default function AutomationRulesPage() {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [wabaId, setWabaId] = useState<string | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  const fetchRules = async (accId: string) => {
    const res: any = await listAutomationRules(accId)
    const list = Array.isArray(res) ? res : res?.data
    setRules(Array.isArray(list) ? [...list].sort((a, b) => a.priority - b.priority) : [])
  }

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext(user.id)
        if (!ctx) {
          setIsLoading(false)
          return
        }
        setAccountId(ctx.accountId)
        setWabaId(ctx.wabaId)
        const [numbersRes] = await Promise.all([
          listWhatsappPhoneNumbers(ctx.accountId),
          fetchRules(ctx.accountId),
        ])
        const numbers = Array.isArray(numbersRes) ? numbersRes : numbersRes?.data
        setPhoneNumbers(Array.isArray(numbers) ? numbers.filter((n: any) => n.status === "registered") : [])
      } catch (err) {
        console.error("Failed to load automation rules:", err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!accountId || !wabaId) return
    listWhatsappTemplates(accountId, wabaId)
      .then((response: any) => {
        const list = Array.isArray(response) ? response : response?.data
        setTemplates(Array.isArray(list) ? list.filter((t: any) => t.status === "APPROVED") : [])
      })
      .catch((err) => console.error("Failed to load templates:", err))
  }, [accountId, wabaId])

  const phoneNumberLabel = (phoneNumberId: string) => {
    const n = phoneNumbers.find((p) => p.phoneNumberId === phoneNumberId)
    return n?.displayPhoneNumber || n?.verifiedName || phoneNumberId
  }

  const resetForm = () => {
    setEditingRule(null)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const openCreateForm = () => {
    setEditingRule(null)
    setForm({ ...EMPTY_FORM, phoneNumberId: phoneNumbers[0]?.phoneNumberId || "" })
    setShowForm(true)
  }

  const openEditForm = (rule: any) => {
    setEditingRule(rule)
    setForm({
      phoneNumberId: rule.phoneNumberId,
      name: rule.name,
      matchType: rule.matchType,
      keywordsText: (rule.keywords || []).join(", "),
      isActive: rule.isActive,
      replyType: rule.replyType,
      replyText: rule.replyText || "",
      replyTemplateName: rule.replyTemplateName || "",
      replyTemplateLanguage: rule.replyTemplateLanguage || "",
      priority: rule.priority ?? 0,
    })
    setShowForm(true)
  }

  const wouldExceedOneActiveAnyRule = () => {
    if (form.matchType !== "any" || !form.isActive) return false
    return rules.some(
      (r) => r.phoneNumberId === form.phoneNumberId && r.matchType === "any" && r.isActive && r.id !== editingRule?.id
    )
  }

  const handleSave = async () => {
    if (!accountId || !wabaId) return
    if (!form.phoneNumberId) {
      toast.error("Pick a phone number")
      return
    }
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    const keywords = form.keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
    if (form.matchType !== "any" && keywords.length === 0) {
      toast.error("Add at least one keyword")
      return
    }
    if (form.replyType === "text" && !form.replyText.trim()) {
      toast.error("Reply text is required")
      return
    }
    if (form.replyType === "template" && (!form.replyTemplateName || !form.replyTemplateLanguage)) {
      toast.error("Pick a reply template")
      return
    }
    if (wouldExceedOneActiveAnyRule()) {
      toast.error("Only one active catch-all (\"any\") rule allowed per phone number — deactivate the existing one first")
      return
    }

    const details: AutomationRuleDetails = {
      accountId,
      wabaId,
      phoneNumberId: form.phoneNumberId,
      name: form.name.trim(),
      matchType: form.matchType,
      keywords: form.matchType === "any" ? [] : keywords,
      isActive: form.isActive,
      replyType: form.replyType,
      priority: form.priority,
      ...(form.replyType === "text"
        ? { replyText: form.replyText.trim() }
        : { replyTemplateName: form.replyTemplateName, replyTemplateLanguage: form.replyTemplateLanguage }),
    }

    setIsSaving(true)
    try {
      if (editingRule) {
        await updateAutomationRule(editingRule.id, details)
        toast.success("Rule updated")
      } else {
        await createAutomationRule(details)
        toast.success("Rule created")
      }
      resetForm()
      fetchRules(accountId)
    } catch (err: any) {
      toast.error(err.message || "Failed to save rule")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (rule: any, isActive: boolean) => {
    if (!accountId) return
    if (rule.matchType === "any" && isActive) {
      const conflict = rules.some(
        (r) => r.phoneNumberId === rule.phoneNumberId && r.matchType === "any" && r.isActive && r.id !== rule.id
      )
      if (conflict) {
        toast.error("Only one active catch-all (\"any\") rule allowed per phone number")
        return
      }
    }
    try {
      await updateAutomationRule(rule.id, { accountId, isActive })
      fetchRules(accountId)
    } catch (err: any) {
      toast.error(err.message || "Failed to update rule")
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!accountId) return
    setDeletingRuleId(ruleId)
    try {
      await deleteAutomationRule(ruleId, accountId)
      toast.success("Rule deleted")
      fetchRules(accountId)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule")
    } finally {
      setDeletingRuleId(null)
    }
  }

  const replyPreview = (rule: any) =>
    rule.replyType === "text" ? rule.replyText : `[template: ${rule.replyTemplateName}]`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Automation</h2>
          <p className="text-muted-foreground">Auto-reply to inbound WhatsApp messages by keyword.</p>
        </div>
        <Dialog open={showForm} onOpenChange={(open) => (open ? openCreateForm() : resetForm())}>
          <DialogTrigger asChild>
            <Button disabled={!accountId || phoneNumbers.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "New Rule"}</DialogTitle>
              <DialogDescription>
                Automation only triggers on inbound text messages, and replies once per inbound message.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Phone Number</Label>
                <Select value={form.phoneNumberId} onValueChange={(v) => setForm({ ...form, phoneNumberId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((n: any) => (
                      <SelectItem key={n.phoneNumberId} value={n.phoneNumberId}>
                        {n.displayPhoneNumber || n.verifiedName || n.phoneNumberId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="rule-name">Name</Label>
                <Input
                  id="rule-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Greeting auto-reply"
                />
              </div>

              <div className="grid gap-2">
                <Label>Match Type</Label>
                <Select value={form.matchType} onValueChange={(v) => setForm({ ...form, matchType: v as MatchType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact match</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="any">Any (catch-all fallback)</SelectItem>
                  </SelectContent>
                </Select>
                {form.matchType === "any" && (
                  <p className="text-xs text-muted-foreground">
                    This rule replies to any message that doesn't match a more specific rule. Only one active
                    catch-all rule is allowed per phone number.
                  </p>
                )}
              </div>

              {form.matchType !== "any" && (
                <div className="grid gap-2">
                  <Label htmlFor="rule-keywords">Keywords (comma separated)</Label>
                  <Input
                    id="rule-keywords"
                    value={form.keywordsText}
                    onChange={(e) => setForm({ ...form, keywordsText: e.target.value })}
                    placeholder="hi, hello, hey"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Reply Type</Label>
                <Select value={form.replyType} onValueChange={(v) => setForm({ ...form, replyType: v as ReplyType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.replyType === "text" ? (
                <div className="grid gap-2">
                  <Label htmlFor="rule-reply-text">Reply Text</Label>
                  <Textarea
                    id="rule-reply-text"
                    value={form.replyText}
                    onChange={(e) => setForm({ ...form, replyText: e.target.value })}
                    placeholder="Thanks for reaching out! We'll get back to you shortly."
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Reply Template</Label>
                  <Select
                    value={form.replyTemplateName}
                    onValueChange={(name) => {
                      const t = templates.find((tpl: any) => tpl.name === name)
                      setForm({ ...form, replyTemplateName: name, replyTemplateLanguage: t?.language || "" })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={templates.length ? "Select a template" : "No approved templates yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t: any) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name} ({t.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Only approved templates can be used as auto-replies.</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="rule-priority">Priority (lower checked first, first match wins)</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingRule ? "Save Changes" : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Matched top-to-bottom by priority — first match wins.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Reply</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                        <span className="text-sm text-muted-foreground">Loading rules...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !accountId ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No WhatsApp Business account connected yet.
                    </TableCell>
                  </TableRow>
                ) : rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No automation rules yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule: any) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>{phoneNumberLabel(rule.phoneNumberId)}</TableCell>
                      <TableCell>
                        {rule.matchType === "any" ? (
                          <Badge variant="outline">Any (fallback)</Badge>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline">{rule.matchType}</Badge>
                            <span className="text-xs text-muted-foreground truncate max-w-48">
                              {(rule.keywords || []).join(", ")}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                        {replyPreview(rule)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(v) => handleToggleActive(rule, v)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditForm(rule)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deletingRuleId === rule.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {deletingRuleId === rule.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{rule.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(rule.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && accountId && phoneNumbers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-accent p-3 mb-3">
                <MessageSquare className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-medium">No registered phone numbers</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Register a WhatsApp phone number before creating automation rules.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
