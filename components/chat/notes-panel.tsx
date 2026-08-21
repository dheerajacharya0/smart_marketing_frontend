"use client"

import { useCallback, useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Loader2, Lock, Send, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "react-hot-toast"
import {
  getConversationNotes,
  addConversationNote,
  deleteConversationNote,
  getUserDataFromCookie,
  type ConversationNote,
} from "@/services/api"
import { initials } from "@/lib/team-display"

// Internal notes — deliberately styled apart from the message thread (amber,
// lock icon, "only your team sees these") so it's never mistaken for a message
// to the contact.
export function NotesPanel({
  conversationId,
  accountId,
  onClose,
}: {
  conversationId: string
  accountId: string
  onClose: () => void
}) {
  const [notes, setNotes] = useState<ConversationNote[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const currentUserId = getUserDataFromCookie()?.id ?? null

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConversationNotes(conversationId, accountId)
      setNotes(Array.isArray(res) ? res : [])
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to load notes")
    } finally {
      setLoading(false)
    }
  }, [conversationId, accountId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleAdd = async () => {
    if (!body.trim()) return
    setIsPosting(true)
    try {
      await addConversationNote(conversationId, accountId, body.trim())
      setBody("")
      fetchNotes()
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to add note")
    } finally {
      setIsPosting(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId)
    try {
      await deleteConversationNote(conversationId, accountId, noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to delete note")
    } finally {
      setDeletingId(null)
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    // Full-width overlay on a phone (there is no room for a third pane) and a
    // fixed side pane from md up.
    <div className="absolute inset-0 z-30 flex h-full w-full flex-col border-l border-warning/30 bg-warning-soft md:static md:z-auto md:w-80 md:shrink-0 md:bg-warning-soft/50">
      <div className="flex items-start justify-between gap-2 border-b border-warning/60 p-4">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 text-warning" />
          <div>
            <h3 className="text-sm font-semibold text-warning">Internal notes</h3>
            <p className="text-xs text-warning/80">Only your team sees these.</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close notes" className="text-warning hover:opacity-70">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : notes.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            No notes yet. Leave context for your teammates here.
          </p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-md border border-warning/60 bg-background p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-warning/20 text-[9px] font-medium text-warning shrink-0">
                    {initials(note.authorName)}
                  </span>
                  <span className="text-xs font-medium truncate">{note.authorName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(note.createdAt)}</span>
                </div>
                {note.authorId === currentUserId && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    aria-label="Delete note"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-warning/60 p-3 space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd()
          }}
          placeholder="Add an internal note…"
          rows={2}
          className="resize-none bg-background"
        />
        <Button size="sm" className="w-full" onClick={handleAdd} disabled={!body.trim() || isPosting}>
          {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Add note
        </Button>
      </div>
    </div>
  )
}
