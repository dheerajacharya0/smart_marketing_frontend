"use client"

import { useEffect, useRef, useState } from "react"
import { Play, RotateCcw, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FlowDefinition, FlowNode } from "@/services/api"

// Client-only walk of the definition — nothing is sent anywhere. Lets authors
// sanity-check branching before going live.

const MAX_AUTO_STEPS = 50
const SAMPLE_CONTACT = { name: "Test Contact", waId: "919876543210" }

interface TranscriptEntry {
  from: "bot" | "me"
  text: string
  buttons?: { title: string; next?: string }[]
}

type SimStatus = "idle" | "waiting_buttons" | "waiting_text" | "completed" | "handed_off" | "error"

function substituteTokens(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, token) => {
    if (token === "name") return SAMPLE_CONTACT.name
    if (token === "waId") return SAMPLE_CONTACT.waId
    return variables[token] ?? match
  })
}

export function FlowSimulator({ definition }: { definition: FlowDefinition }) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [path, setPath] = useState<string[]>([])
  const [status, setStatus] = useState<SimStatus>("idle")
  const [waitingNode, setWaitingNode] = useState<FlowNode | null>(null)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript.length])

  const byId = new Map(definition.nodes.map((n) => [n.id, n]))

  // Walk from a node, auto-advancing through messages until the flow waits,
  // ends, or hits the step cap. Mutates via the passed accumulators, then
  // commits state once.
  const run = (
    startId: string | undefined,
    vars: Record<string, string>,
    entries: TranscriptEntry[],
    visited: string[]
  ) => {
    let currentId = startId
    let steps = 0
    while (currentId) {
      if (++steps > MAX_AUTO_STEPS) {
        setStatus("error")
        entries.push({ from: "bot", text: "⚠ Stopped after 50 auto-steps — check for loops." })
        break
      }
      const node = byId.get(currentId)
      if (!node) {
        setStatus("error")
        entries.push({ from: "bot", text: `⚠ Unknown node "${currentId}"` })
        break
      }
      visited.push(node.id)
      const text = "text" in node && node.text ? substituteTokens(node.text, vars) : ""

      if (node.type === "message") {
        entries.push({ from: "bot", text })
        currentId = node.next
        if (!currentId) setStatus("completed")
        continue
      }
      if (node.type === "buttons") {
        entries.push({ from: "bot", text, buttons: node.buttons })
        setWaitingNode(node)
        setStatus("waiting_buttons")
        break
      }
      if (node.type === "question") {
        entries.push({ from: "bot", text })
        setWaitingNode(node)
        setStatus("waiting_text")
        break
      }
      if (node.type === "handoff") {
        if (text) entries.push({ from: "bot", text })
        entries.push({ from: "bot", text: "🤝 Handed off to a human agent." })
        setStatus("handed_off")
        break
      }
      // end
      if (text) entries.push({ from: "bot", text })
      setStatus("completed")
      break
    }
    setTranscript([...entries])
    setVariables({ ...vars })
    setPath([...visited])
  }

  const start = () => {
    setWaitingNode(null)
    setInput("")
    run(definition.entryNodeId, {}, [], [])
  }

  const handleButtonClick = (button: { title: string; next?: string }) => {
    if (status !== "waiting_buttons") return
    const entries = [...transcript, { from: "me" as const, text: button.title }]
    setWaitingNode(null)
    if (!button.next) {
      setTranscript(entries)
      setStatus("completed")
      return
    }
    run(button.next, { ...variables }, entries, [...path])
  }

  const handleTextSubmit = () => {
    if (!input.trim() || !waitingNode) return
    const text = input.trim()
    setInput("")
    const entries = [...transcript, { from: "me" as const, text }]

    if (waitingNode.type === "question") {
      const vars = { ...variables, [waitingNode.variable]: text }
      setWaitingNode(null)
      if (!waitingNode.next) {
        setTranscript(entries)
        setVariables(vars)
        setStatus("completed")
        return
      }
      run(waitingNode.next, vars, entries, [...path])
      return
    }

    if (waitingNode.type === "buttons") {
      // Free text on a buttons node goes to fallbackNext (or ends the flow)
      const fallback = waitingNode.fallbackNext
      setWaitingNode(null)
      if (!fallback) {
        entries.push({ from: "bot", text: "(no fallback — flow ended)" })
        setTranscript(entries)
        setStatus("completed")
        return
      }
      run(fallback, { ...variables }, entries, [...path])
    }
  }

  const statusBadge = () => {
    switch (status) {
      case "waiting_buttons":
      case "waiting_text":
        return <Badge variant="outline">Waiting for reply</Badge>
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">Completed</Badge>
      case "handed_off":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400">Handed off</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={start}>
          {status === "idle" ? <Play className="mr-2 h-3.5 w-3.5" /> : <RotateCcw className="mr-2 h-3.5 w-3.5" />}
          {status === "idle" ? "Start test" : "Restart"}
        </Button>
        {statusBadge()}
      </div>

      <div className="h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-2">
        {transcript.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Runs entirely in your browser — no messages are sent.
          </p>
        )}
        {transcript.map((entry, i) => (
          <div key={i} className={`flex ${entry.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                entry.from === "me" ? "bg-primary text-primary-foreground" : "bg-background border"
              }`}
            >
              {entry.text || <span className="opacity-50">(empty text)</span>}
              {entry.buttons && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {entry.buttons.map((b, bi) => (
                    <Button
                      key={bi}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={status !== "waiting_buttons" || i !== transcript.length - 1}
                      onClick={() => handleButtonClick(b)}
                    >
                      {b.title || `Button ${bi + 1}`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {(status === "waiting_text" || status === "waiting_buttons") && (
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTextSubmit()
            }}
            placeholder={status === "waiting_text" ? "Type a reply…" : "Type a non-button reply (tests fallback)…"}
            className="h-9"
          />
          <Button size="sm" onClick={handleTextSubmit} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {(path.length > 0 || Object.keys(variables).length > 0) && (
        <div className="space-y-2">
          {path.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Path:</span>
              {path.map((id, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-xs text-muted-foreground">→</span>}
                  <Badge variant="outline" className="text-xs font-mono">
                    {id}
                  </Badge>
                </span>
              ))}
            </div>
          )}
          {Object.keys(variables).length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Variables:</span>
              {Object.entries(variables).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-xs">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
