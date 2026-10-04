import { describe, expect, it } from "vitest"
import type { Contact } from "@/services/api"
import {
  consentState,
  CONSENT_SOURCES,
  OPT_IN_SOURCE_LABELS,
  optStatusTooltip,
  optedOutViaStop,
} from "@/lib/contact-consent"

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    waId: "919000000000",
    name: "Test",
    tags: [],
    attributes: {},
    optedIn: false,
    optedInAt: null,
    optedOutAt: null,
    optInSource: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("opt-in source labels", () => {
  // services/api.ts calls optInContact() with a "manual" default and the
  // backend stores `source ?? 'api'` verbatim, so both spellings reach the UI
  // and both have to resolve — "manual" previously didn't, and the source was
  // dropped from the tooltip for every contact opted in from the UI.
  it.each(["manual", "api", "csv_import", "whatsapp_keyword"])("resolves %s", (source) => {
    expect(OPT_IN_SOURCE_LABELS[source]).toBeTruthy()
  })

  it("resolves every source the bulk consent flow can write", () => {
    for (const source of CONSENT_SOURCES) {
      expect(OPT_IN_SOURCE_LABELS[source.value]).toBe(source.label)
    }
  })

  it("keeps source values within the backend's 100-char limit", () => {
    for (const source of CONSENT_SOURCES) {
      expect(source.value.length).toBeLessThanOrEqual(100)
    }
  })

  it("uses distinct values", () => {
    const values = CONSENT_SOURCES.map((s) => s.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe("optStatusTooltip", () => {
  it("names how consent was given", () => {
    const tip = optStatusTooltip(
      contact({ optedIn: true, optInSource: "manual", optedInAt: "2026-02-03T10:00:00.000Z" }),
    )
    expect(tip).toContain("Opted in")
    expect(tip).toContain("Manually")
  })

  it("names a bulk-recorded source", () => {
    const tip = optStatusTooltip(contact({ optedIn: true, optInSource: "existing_records" }))
    expect(tip).toContain("Existing opt-in records")
  })

  it("does not print a raw source key it has no label for", () => {
    const tip = optStatusTooltip(contact({ optedIn: true, optInSource: "something_new" }))
    expect(tip).not.toContain("something_new")
  })

  it("calls out a STOP unsubscribe, which must not be silently re-opted in", () => {
    const c = contact({ optedIn: false, optInSource: "whatsapp_keyword" })
    expect(optedOutViaStop(c)).toBe(true)
    expect(optStatusTooltip(c)).toContain("STOP")
  })
})

describe("consentState", () => {
  it("tells a withdrawal apart from no consent at all", () => {
    expect(consentState({ optedIn: true, optedOutAt: null })).toBe("in")
    expect(consentState({ optedIn: false, optedOutAt: "2026-10-01T00:00:00Z" })).toBe("out")
    expect(consentState({ optedIn: false, optedOutAt: null })).toBe("none")
  })
})
