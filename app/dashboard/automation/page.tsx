"use client"

import { useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { AlertTriangle, Loader2, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutomationPickerNote } from "@/components/automation-picker-note"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  getContactAttributeKeys,
  listContactTags,
  listFlows,
  listWhatsappPhoneNumbers,
  listWhatsappTemplates,
  type AutomationAction,
  type AutomationConditions,
  type AutomationRule,
  type AutomationRuleDetails,
  type AutomationTrigger,
  type Flow,
  type WhatsappPhoneNumber,
  type WhatsappTemplate,
  createAutomationRule,
  listAutomationRules,
  updateAutomationRule,
  deleteAutomationRule,
} from "@/services/api"
import { useTeamMembers } from "@/hooks/use-team-members"
import {
  NAME_MAX,
  PRIORITY_MAX,
  PRIORITY_MIN,
  defaultAction,
  defaultTrigger,
  describeAction,
  describeTrigger,
  isCatchAll,
  normalizeConditions,
  shadowedBy,
  validateRule,
  type RuleIssue,
} from "@/lib/automation-rules"
import { RuleActionsEditor } from "./rule-actions-editor"
import { RuleConditionsEditor } from "./rule-conditions-editor"
import { RuleTriggerEditor } from "./rule-trigger-editor"

interface RuleForm {
  phoneNumberId: string
  name: string
  trigger: AutomationTrigger
  conditions: AutomationConditions | null
  actions: AutomationAction[]
  isActive: boolean
  priority: number
}

function emptyForm(phoneNumberId = ""): RuleForm {
  return {
    phoneNumberId,
    name: "",
    trigger: defaultTrigger("keyword"),
    conditions: null,
    actions: [defaultAction("send_text")],
    isActive: true,
    priority: 0,
  }
}

export default function AutomationRulesPage() {
  const [accountId, setAccountId] = useState<string | null>(null)
  const [wabaId, setWabaId] = useState<string | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<WhatsappPhoneNumber[]>([])
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [flows, setFlows] = useState<Flow[]>([])
  const [attributeKeys, setAttributeKeys] = useState<string[]>([])
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [form, setForm] = useState<RuleForm>(() => emptyForm())
  const [showIssues, setShowIssues] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)

  const { assignees } = useTeamMembers(accountId)

  const fetchRules = async (accId: string) => {
    const res = await listAutomationRules(accId)
    setRules(Array.isArray(res) ? [...res].sort((a, b) => a.priority - b.priority) : [])
  }

  useEffect(() => {
    const init = async () => {
      const user = getUserDataFromCookie()
      if (!user?.id) {
        setIsLoading(false)
        return
      }
      try {
        const ctx = await getActiveWhatsappContext()
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
        setPhoneNumbers(numbersRes.filter((n) => n.status === "registered"))
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
      .then((response) => {
        setTemplates(Array.isArray(response) ? response.filter((t) => t.status === "APPROVED") : [])
      })
      .catch((err) => console.error("Failed to load templates:", err))
  }, [accountId, wabaId])

  // Everything the action/condition rows offer as a choice. Each is optional:
  // a failed load costs a suggestion list, never the ability to save a rule.
  useEffect(() => {
    if (!accountId) return
    listFlows(accountId)
      .then((res) => setFlows(Array.isArray(res) ? res : []))
      .catch(() => {})
    getContactAttributeKeys(accountId)
      .then((keys) => {
        if (Array.isArray(keys)) setAttributeKeys([...new Set(keys)].sort())
      })
      .catch(() => {})
    // Server-side aggregate over every contact, ordered by usage — a rule that
    // fires on a tag has to be able to name a tag that isn't on the first page
    // of contacts.
    listContactTags(accountId)
      .then((tags) => {
        if (Array.isArray(tags)) setKnownTags(tags.map((t) => t.tag))
      })
      .catch(() => {})
  }, [accountId])

  const phoneNumberLabel = (phoneNumberId: string) => {
    const n = phoneNumbers.find((p) => p.phoneNumberId === phoneNumberId)
    return n?.displayPhoneNumber || n?.verifiedName || phoneNumberId
  }

  const flowNames = useMemo(
    () => Object.fromEntries(flows.map((f) => [f.id, f.name])),
    [flows]
  )
  const agentNames = useMemo(
    () => Object.fromEntries(assignees.map((a) => [a.userId, a.name])),
    [assignees]
  )

  const issues: RuleIssue[] = useMemo(
    () =>
      validateRule({
        name: form.name,
        phoneNumberId: form.phoneNumberId,
        trigger: form.trigger,
        conditions: form.conditions,
        actions: form.actions,
        priority: form.priority,
      }),
    [form]
  )
  const issuesFor = (field: RuleIssue["field"]) =>
    showIssues ? issues.filter((i) => i.field === field) : []

  const resetForm = () => {
    setEditingRule(null)
    setForm(emptyForm())
    setShowIssues(false)
    setShowForm(false)
  }

  const openCreateForm = () => {
    setEditingRule(null)
    setForm(emptyForm(phoneNumbers[0]?.phoneNumberId || ""))
    setShowIssues(false)
    setShowForm(true)
  }

  const openEditForm = (rule: AutomationRule) => {
    setEditingRule(rule)
    setForm({
      phoneNumberId: rule.phoneNumberId,
      name: rule.name,
      // Cloned so editing the dialog doesn't mutate the row behind it — a
      // cancelled edit has to leave the list exactly as it was.
      trigger: structuredClone(rule.trigger),
      conditions: rule.conditions ? structuredClone(rule.conditions) : null,
      actions: structuredClone(rule.actions),
      isActive: rule.isActive,
      priority: rule.priority ?? 0,
    })
    setShowIssues(false)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!accountId || !wabaId) return
    if (issues.length > 0) {
      setShowIssues(true)
      toast.error(issues[0].message)
      return
    }

    const details: AutomationRuleDetails = {
      accountId,
      wabaId,
      phoneNumberId: form.phoneNumberId,
      name: form.name.trim(),
      trigger: form.trigger,
      conditions: normalizeConditions(form.conditions),
      actions: form.actions,
      isActive: form.isActive,
      priority: form.priority,
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
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to save rule")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (rule: AutomationRule, isActive: boolean) => {
    if (!accountId) return
    try {
      await updateAutomationRule(rule.id, { accountId, isActive })
      fetchRules(accountId)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to update rule")
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!accountId) return
    setDeletingRuleId(ruleId)
    try {
      await deleteAutomationRule(ruleId, accountId)
      toast.success("Rule deleted")
      fetchRules(accountId)
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to delete rule")
    } finally {
      setDeletingRuleId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Automation</h2>
          <p className="text-muted-foreground">
            When something happens, do something — auto-replies, tags, handoffs.
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={(open) => (open ? openCreateForm() : resetForm())}>
          <DialogTrigger asChild>
            <Button disabled={!accountId || phoneNumbers.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "New Rule"}</DialogTitle>
              <DialogDescription>
                One trigger, optional conditions, and the actions to run. Only the first matching
                rule fires per event.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Phone Number</Label>
                <Select
                  value={form.phoneNumberId}
                  onValueChange={(v) => setForm({ ...form, phoneNumberId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((n) => (
                      <SelectItem key={n.phoneNumberId} value={n.phoneNumberId}>
                        {n.displayPhoneNumber || n.verifiedName || n.phoneNumberId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {issuesFor("phoneNumberId").map((i) => (
                  <p key={i.message} className="text-xs text-destructive">
                    {i.message}
                  </p>
                ))}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="rule-name">Name</Label>
                <Input
                  id="rule-name"
                  value={form.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Opening hours auto-reply"
                />
                {issuesFor("name").map((i) => (
                  <p key={i.message} className="text-xs text-destructive">
                    {i.message}
                  </p>
                ))}
              </div>

              <RuleTriggerEditor
                key={editingRule?.id ?? "new"}
                trigger={form.trigger}
                onChange={(trigger) => setForm({ ...form, trigger })}
                issues={issuesFor("trigger").map((i) => i.message)}
              />

              <RuleConditionsEditor
                conditions={form.conditions}
                onChange={(conditions) => setForm({ ...form, conditions })}
                issues={issuesFor("conditions")}
              />

              <RuleActionsEditor
                actions={form.actions}
                onChange={(actions) => setForm({ ...form, actions })}
                issues={issuesFor("actions")}
                templates={templates}
                flows={flows}
                agents={assignees}
              />

              <div className="grid gap-2">
                <Label htmlFor="rule-priority">Priority (lower runs first, first match wins)</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  min={PRIORITY_MIN}
                  max={PRIORITY_MAX}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Math.trunc(Number(e.target.value)) })}
                />
                {issuesFor("priority").map((i) => (
                  <p key={i.message} className="text-xs text-destructive">
                    {i.message}
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Active</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
              </div>
            </div>

            {/* Shared by both editors: an id has to be unique per document. */}
            <datalist id="automation-known-tags">
              {knownTags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <datalist id="automation-attribute-keys">
              {attributeKeys.map((key) => (
                <option key={key} value={key} />
              ))}
            </datalist>

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

      <AutomationPickerNote current="automation" />

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Checked in priority order — the first match wins.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Then</TableHead>
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
                  rules.map((rule) => {
                    const shadows = shadowedBy(rule, rules)
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {rule.name}
                          {shadows.length > 0 && (
                            <span
                              className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-500"
                              title={`"${shadows[0].name}" replies to every message at priority ${shadows[0].priority}, so this rule never runs.`}
                            >
                              <AlertTriangle className="h-3 w-3" /> never runs
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{phoneNumberLabel(rule.phoneNumberId)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit">
                              {isCatchAll(rule.trigger) ? "catch-all" : rule.trigger.type.replace("_", " ")}
                            </Badge>
                            <span className="max-w-52 truncate text-xs text-muted-foreground">
                              {describeTrigger(rule.trigger)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-64 text-sm text-muted-foreground">
                          <span className="block truncate">
                            {rule.actions.length
                              ? describeAction(rule.actions[0], {
                                  flows: flowNames,
                                  agents: agentNames,
                                })
                              : "—"}
                          </span>
                          {rule.actions.length > 1 && (
                            <span className="text-xs">+{rule.actions.length - 1} more</span>
                          )}
                          {rule.conditions && (
                            <span className="text-xs"> · {rule.conditions.conditions.length} condition
                              {rule.conditions.conditions.length === 1 ? "" : "s"}
                            </span>
                          )}
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
                                  <AlertDialogTitle>Delete &quot;{rule.name}&quot;?</AlertDialogTitle>
                                  <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(rule.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
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
