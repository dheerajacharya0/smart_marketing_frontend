"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

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
  // Stable identity when `override` hasn't actually changed — the consuming
  // effect below depends on this object, and an unmemoized literal here gave
  // it a new identity every render, including the renders its own setOverride
  // call caused. That re-triggered the effect every time, which called
  // setOverride again: an infinite update loop (React error #185).
  const value = useMemo(() => ({ override, setOverride }), [override, setOverride])
  return <TemplatesBackContext.Provider value={value}>{children}</TemplatesBackContext.Provider>
}

export function useTemplatesBackOverride() {
  return useContext(TemplatesBackContext)
}
