"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

type BackOverride = (() => void) | null

interface TemplatesBackValue {
  override: BackOverride
  setOverride: (fn: BackOverride) => void
}

const TemplatesBackContext = createContext<TemplatesBackValue | null>(null)

/**
 * Lets the page (which owns the New Template form's open/closed state) tell
 * the layout's top Back button to close that form first instead of leaving
 * the section — the same "back closes the sub-view first" rule most nav
 * patterns follow. Without this, Back always did a raw history pop and left
 * Templates entirely even while a draft form was open.
 */
export function TemplatesBackProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<BackOverride>(null)
  // Wrapped so passing a function to setOverride doesn't get treated as a
  // lazy-initializer by useState's setter.
  const setOverride = useCallback((fn: BackOverride) => setOverrideState(() => fn), [])
  return (
    <TemplatesBackContext.Provider value={{ override, setOverride }}>
      {children}
    </TemplatesBackContext.Provider>
  )
}

export function useTemplatesBackOverride() {
  return useContext(TemplatesBackContext)
}
