"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { FlowDefinition } from "@/services/api"
import { autoLayout, loadFlowLayout, saveFlowLayout, type FlowLayout, type NodePosition } from "@/lib/flow-layout"

/**
 * Canvas coordinates for a flow's nodes.
 *
 * Owned by the builder rather than the canvas because the two operations that
 * invalidate a position — renaming a node (its key changes) and deleting one
 * (its key should go) — happen in the builder's definition handlers, and a
 * canvas that learned about them afterwards would show the node jump back to
 * the auto-layout for a frame.
 */
export function useFlowLayout(flowKey: string, definition: FlowDefinition) {
  const [positions, setPositions] = useState<FlowLayout>(() => ({
    // Precedence, weakest first: the layout derived from the graph, then what
    // the flow was saved with, then this browser's unsaved drags. A saved
    // layout beats `localStorage` because it is the shared one — a teammate's
    // arrangement should not lose to a stale local copy — but a flow saved
    // before layouts existed still gets whatever was dragged here.
    ...autoLayout(definition),
    ...(definition.layout ?? loadFlowLayout(flowKey)),
  }))

  // Keeps the newest definition available to callbacks without making them
  // change identity on every keystroke in a node's text field.
  const definitionRef = useRef(definition)
  definitionRef.current = definition

  // Any node without a position — added from the palette's click path, or
  // created by a "+ create node" target — is placed by re-running the layout
  // and taking only the entries that are missing, so existing cards never move
  // under the cursor.
  useEffect(() => {
    setPositions((prev) => {
      const missing = definition.nodes.filter((n) => !prev[n.id])
      if (missing.length === 0) return prev
      const auto = autoLayout(definition)
      const next = { ...prev }
      for (const node of missing) next[node.id] = auto[node.id] ?? { x: 40, y: 40 }
      return next
    })
  }, [definition])

  const persist = useCallback(
    (next: FlowLayout) => {
      // Only nodes that still exist are written back: a stale key would resurrect
      // a position if the same node id is later reused.
      const live = new Set(definitionRef.current.nodes.map((n) => n.id))
      const pruned: FlowLayout = {}
      for (const [id, pos] of Object.entries(next)) if (live.has(id)) pruned[id] = pos
      saveFlowLayout(flowKey, pruned)
    },
    [flowKey]
  )

  const moveNode = useCallback((id: string, position: NodePosition) => {
    setPositions((prev) => ({ ...prev, [id]: position }))
  }, [])

  const commitPositions = useCallback(() => {
    setPositions((prev) => {
      persist(prev)
      return prev
    })
  }, [persist])

  const renameNodeKey = useCallback((oldId: string, newId: string) => {
    setPositions((prev) => {
      if (!prev[oldId]) return prev
      const next = { ...prev, [newId]: prev[oldId] }
      delete next[oldId]
      return next
    })
  }, [])

  const forgetNode = useCallback((id: string) => {
    setPositions((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const placeNode = useCallback((id: string, position: NodePosition) => {
    setPositions((prev) => ({ ...prev, [id]: position }))
  }, [])

  /**
   * Positions to send with the definition, pruned to nodes that still exist —
   * a stale key would resurrect a position if its id were ever reused, and the
   * server caps how many entries it will store.
   */
  const layoutForSave = useCallback((): FlowLayout => {
    const live = new Set(definitionRef.current.nodes.map((n) => n.id))
    const out: FlowLayout = {}
    for (const [id, pos] of Object.entries(positions)) if (live.has(id)) out[id] = pos
    return out
  }, [positions])

  /** Throws away hand-placed positions and returns to the derived layout. */
  const resetLayout = useCallback(() => {
    const auto = autoLayout(definitionRef.current)
    setPositions(auto)
    saveFlowLayout(flowKey, {})
  }, [flowKey])

  return {
    positions,
    moveNode,
    commitPositions,
    renameNodeKey,
    forgetNode,
    placeNode,
    resetLayout,
    layoutForSave,
  }
}
