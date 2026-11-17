"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/errors"
import { Loader2, Lock, Send, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LoadFailed } from "@/components/load-failed"
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

  const [loadError, setLoadError] = useState<string | null>(null)
  // Only the latest read may write: switching conversation while one is in
  // flight must not land the old conversation's notes under the new one.
  const latestRequest = useRef(0)

  const fetchNotes = useCallback(async () => {
    const requestId = ++latestRequest.current
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getConversationNotes(conversationId, accountId)
      if (requestId !== latestRequest.current) return
      setNotes(Array.isArray(res) ? res : [])
    } catch (err) {
      if (requestId !== latestRequest.current) return
      // Kept apart from the list: a failed read used to leave it empty and
      // say "No notes yet", telling an agent there was no context to read.
      setLoadError(getErrorMessage(err) || "Couldn't load notes")
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [conversationId, accountId])

  useEffect(() => {
    // A different conversation's notes must not stay on screen while (or if)
    // this one's fail to load.
    setNotes([])
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
        ) : loadError && notes.length === 0 ? (
          <LoadFailed className="py-8" message={loadError} onRetry={() => void fetchNotes()} />
        ) : notes.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            No notes yet. Leave context for your teammates here.
          </p>
        ) : (
          // A refresh that failed after adding a note keeps what's on screen
          // and says so above it, rather than dropping the list.
          <>
          {loadError && <LoadFailed className="py-2" message={loadError} onRetry={() => void fetchNotes()} />}
          {notes.map((note) => (
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
          ))}
          </>
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
