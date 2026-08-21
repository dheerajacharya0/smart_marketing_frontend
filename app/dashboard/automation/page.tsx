"use client"

import { useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import Link from "next/link"
import { AlertTriangle, ChevronDown, Loader2, MessageSquare, Pencil, Plus, Trash2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AutomationPickerNote } from "@/components/automation-picker-note"
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

  // Whether the folded section holds anything, and how to say so on the
  // trigger. Editing a rule that uses either must not hide it — a fold that
  // conceals settings already in effect is worse than no fold.
  const conditionCount = form.conditions?.conditions.length ?? 0
  const hasAdvanced = conditionCount > 0 || form.priority !== 0
  const advancedSummary = (() => {
    const parts: string[] = []
    if (conditionCount > 0)
      parts.push(`${conditionCount} condition${conditionCount === 1 ? "" : "s"}`)
    if (form.priority !== 0) parts.push(`priority ${form.priority}`)
    return parts.length ? parts.join(" · ") : "Conditions and priority"
  })()

  const columns: Column<AutomationRule>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      sortValue: (rule) => rule.name,
      cell: (rule) => {
        const shadows = shadowedBy(rule, rules)
        return (
          <div>
            <span className="font-medium">{rule.name}</span>
            {shadows.length > 0 && (
              <span
                className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-warning"
                title={`"${shadows[0].name}" replies to every message at priority ${shadows[0].priority}, so this rule never runs.`}
              >
                <AlertTriangle className="h-3 w-3" /> never runs
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: "phone",
      header: "Phone number",
      card: "meta",
      className: "hide-on-lg",
      sortValue: (rule) => phoneNumberLabel(rule.phoneNumberId),
      cell: (rule) => (
        <span className="text-sm">{phoneNumberLabel(rule.phoneNumberId)}</span>
      ),
    },
    {
      key: "when",
      header: "When",
      cardLabel: "When",
      sortValue: (rule) => rule.trigger.type,
      cell: (rule) => (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            {isCatchAll(rule.trigger) ? "catch-all" : rule.trigger.type.replace("_", " ")}
          </Badge>
          <span className="max-w-52 truncate text-xs text-muted-foreground">
            {describeTrigger(rule.trigger)}
          </span>
        </div>
      ),
    },
    {
      key: "then",
      header: "Then",
      cardLabel: "Then",
      className: "max-w-64",
      cell: (rule) => (
        <div className="text-sm text-muted-foreground">
          <span className="block truncate">
            {rule.actions.length
              ? describeAction(rule.actions[0], { flows: flowNames, agents: agentNames })
              : "—"}
          </span>
          {rule.actions.length > 1 && (
            <span className="text-xs">+{rule.actions.length - 1} more</span>
          )}
          {rule.conditions && (
            <span className="text-xs">
              {" "}
              · {rule.conditions.conditions.length} condition
              {rule.conditions.conditions.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "active",
      header: "Active",
      cardLabel: "Active",
      sortValue: (rule) => (rule.isActive ? 0 : 1),
      cell: (rule) => (
        <Switch
          checked={rule.isActive}
          onCheckedChange={(v) => handleToggleActive(rule, v)}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "actions",
      cell: (rule) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" title="Edit" onClick={() => openEditForm(rule)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                title="Delete"
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
      ),
    },
  ]

  return (
    <Dialog open={showForm} onOpenChange={(open) => (open ? openCreateForm() : resetForm())}>
      <div className="space-y-6">
        <PageHeader
          title="Automation"
          description="When something happens, do something — auto-replies, tags, handoffs."
          actions={
            <DialogTrigger asChild>
              <Button disabled={!accountId || phoneNumbers.length === 0}>
                <Plus className="mr-2 h-4 w-4" /> New rule
              </Button>
            </DialogTrigger>
          }
        />
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

              <RuleActionsEditor
                actions={form.actions}
                onChange={(actions) => setForm({ ...form, actions })}
                issues={issuesFor("actions")}
                templates={templates}
                flows={flows}
                agents={assignees}
              />

              <div className="flex items-center justify-between rounded-lg border border-border-subtle p-3">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    An inactive rule is kept but never fires.
                  </p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
              </div>

              {/*
                Everything below is optional. A first rule is a trigger and an
                action — "someone texts hours, send the opening times" — and
                asking for narrowing conditions and a priority number before
                that rule exists is what makes this screen feel like a config
                file. Both are opened by anyone who needs them, and the
                summary line says when that is.
              */}
              <Collapsible defaultOpen={hasAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-3"
                    type="button"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      Fine-tuning
                      <span className="text-xs font-normal text-muted-foreground">
                        {advancedSummary}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast ease-out-soft data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3">
                  <RuleConditionsEditor
                    conditions={form.conditions}
                    onChange={(conditions) => setForm({ ...form, conditions })}
                    issues={issuesFor("conditions")}
                  />

                  <div className="grid gap-2">
                    <Label htmlFor="rule-priority">Priority</Label>
                    <Input
                      id="rule-priority"
                      type="number"
                      min={PRIORITY_MIN}
                      max={PRIORITY_MAX}
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: Math.trunc(Number(e.target.value)) })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower numbers are checked first, and only the first matching rule fires.
                      Leave it at 0 unless two rules could match the same message.
                    </p>
                    {issuesFor("priority").map((i) => (
                      <p key={i.message} className="text-xs text-destructive">
                        {i.message}
                      </p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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

      <AutomationPickerNote current="automation" />

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Checked in priority order — the first match wins.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rules}
            getRowKey={(rule) => rule.id}
            isLoading={isLoading}
            skeletonRows={4}
            // Rules are returned in priority order and that order is the
            // behaviour — re-sorting by name would show a sequence the engine
            // does not follow. Sorting is still offered per column for
            // finding a rule; the default stays as the server sent it.
            empty={
              !accountId ? (
                <EmptyState
                  plain
                  icon={MessageSquare}
                  title="No connected account yet"
                  description="Link a WhatsApp Business account before setting up automation."
                />
              ) : phoneNumbers.length === 0 ? (
                <EmptyState
                  plain
                  icon={MessageSquare}
                  title="No registered phone numbers"
                  description="Register a WhatsApp phone number before creating automation rules."
                  action={
                    <Button asChild>
                      <Link href="/dashboard/whatsapp">Go to WhatsApp setup</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Zap}
                  title="No rules yet"
                  description="A rule is one trigger and one action — someone texts “hours”, you send your opening times."
                  action={
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" /> New rule
                      </Button>
                    </DialogTrigger>
                  }
                  hint="Rules run on incoming messages. For anything that needs to ask a question and branch, build a flow instead."
                />
              )
            }
          />
        </CardContent>
      </Card>
      </div>
    </Dialog>
  )
}
