"use client"

import { useEffect, useMemo, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Check, ChevronDown, Plus, Tag, UserCircle, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "react-hot-toast"
import {
  assignConversation,
  unassignConversation,
  addConversationLabel,
  removeConversationLabel,
} from "@/services/api"
import { useTeamMembers } from "@/hooks/use-team-members"
import { displayLabel, initials } from "@/lib/team-display"

// Assignee dropdown + label chips for the thread header. Optimistic: local
// state updates immediately, then re-syncs from props when the WS broadcast
// (or a refetch) lands the authoritative values.
export function ConversationMeta({
  conversationId,
  accountId,
  assigneeId,
  assigneeName,
  labels,
  knownLabels,
}: {
  conversationId: string
  accountId: string
  assigneeId: string | null
  assigneeName: string | null
  labels: string[]
  knownLabels: string[]
}) {
  const { assignees } = useTeamMembers(accountId)

  const [localAssignee, setLocalAssignee] = useState<{ id: string | null; name: string | null }>({
    id: assigneeId,
    name: assigneeName,
  })
  const [localLabels, setLocalLabels] = useState<string[]>(labels)
  const [labelInput, setLabelInput] = useState("")
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    setLocalAssignee({ id: assigneeId, name: assigneeName })
  }, [assigneeId, assigneeName])
  useEffect(() => {
    setLocalLabels(labels)
  }, [labels])

  const handleAssign = async (userId: string, name: string) => {
    const prev = localAssignee
    setLocalAssignee({ id: userId, name })
    try {
      await assignConversation(conversationId, accountId, userId)
      toast.success(`Assigned to ${name}`)
    } catch (err) {
      setLocalAssignee(prev)
      toast.error(getErrorMessage(err) || "Failed to assign")
    }
  }

  const handleUnassign = async () => {
    const prev = localAssignee
    setLocalAssignee({ id: null, name: null })
    try {
      await unassignConversation(conversationId, accountId)
      toast.success("Unassigned")
    } catch (err) {
      setLocalAssignee(prev)
      toast.error(getErrorMessage(err) || "Failed to unassign")
    }
  }

  const handleAddLabel = async (raw: string) => {
    const label = raw.trim().toLowerCase()
    if (!label || localLabels.includes(label)) {
      setLabelInput("")
      setAddOpen(false)
      return
    }
    setLocalLabels((prev) => [...prev, label])
    setLabelInput("")
    setAddOpen(false)
    try {
      await addConversationLabel(conversationId, accountId, label)
    } catch (err) {
      setLocalLabels((prev) => prev.filter((l) => l !== label))
      toast.error(getErrorMessage(err) || "Failed to add label")
    }
  }

  const handleRemoveLabel = async (label: string) => {
    setLocalLabels((prev) => prev.filter((l) => l !== label))
    try {
      await removeConversationLabel(conversationId, accountId, label)
    } catch (err) {
      setLocalLabels((prev) => [...prev, label])
      toast.error(getErrorMessage(err) || "Failed to remove label")
    }
  }

  // Label suggestions: known labels across the account, minus ones already set,
  // filtered by what's typed.
  const suggestions = useMemo(() => {
    const q = labelInput.trim().toLowerCase()
    return knownLabels
      .filter((l) => !localLabels.includes(l))
      .filter((l) => !q || l.includes(q))
      .slice(0, 6)
  }, [knownLabels, localLabels, labelInput])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Assignee */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {localAssignee.id ? (
              <>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-medium text-primary mr-1.5">
                  {initials(localAssignee.name || "?")}
                </span>
                {localAssignee.name}
              </>
            ) : (
              <>
                <UserCircle className="mr-1.5 h-4 w-4" /> Unassigned
              </>
            )}
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
          {assignees.map((a) => (
            <DropdownMenuItem key={a.userId} onClick={() => handleAssign(a.userId, a.name)}>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-medium text-primary mr-2">
                {initials(a.name)}
              </span>
              <span className="flex-1 truncate">{a.name}</span>
              {localAssignee.id === a.userId && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
          {localAssignee.id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleUnassign}>
                <UserCircle className="mr-2 h-4 w-4" /> Unassign
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Labels */}
      {localLabels.map((label) => (
        <Badge key={label} variant="secondary" className="h-8 gap-1 pl-2 pr-1">
          {displayLabel(label)}
          <button
            onClick={() => handleRemoveLabel(label)}
            aria-label={`Remove ${label} label`}
            className="rounded-full hover:bg-background/60 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          {/* Icon-only, this read as a dead "+" next to the tag glyph — say
              what it does. */}
          <Button variant="outline" size="sm" className="h-8" title="Add a label to this conversation">
            <Tag className="mr-1.5 h-3.5 w-3.5" /> Add label
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2 space-y-2">
          <Input
            autoFocus
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddLabel(labelInput)
            }}
            placeholder="Add a label…"
            className="h-8"
          />
          {suggestions.length > 0 && (
            <div className="space-y-0.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleAddLabel(s)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" /> {displayLabel(s)}
                </button>
              ))}
            </div>
          )}
          {labelInput.trim() && !suggestions.includes(labelInput.trim().toLowerCase()) && (
            <button
              onClick={() => handleAddLabel(labelInput)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" /> Create "{labelInput.trim().toLowerCase()}"
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
