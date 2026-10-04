import { describe, expect, it } from "vitest"
import {
  baseTagSelector,
  describeTagAudience,
  EMPTY_TAG_AUDIENCE,
  filterTagCount,
  fromRules,
  MAX_FILTER_TAGS,
  MAX_GROUP_MEMBERS,
  toSelector,
  type TagAudience,
} from "./audience-tags"

const audience = (a: Partial<TagAudience>): TagAudience => ({ ...EMPTY_TAG_AUDIENCE, ...a })

describe("toSelector", () => {
  it("is null until a tag is picked", () => {
    expect(toSelector(EMPTY_TAG_AUDIENCE)).toBeNull()
  })

  // Older screens know how to show a plain tag; keep it plain when it can be.
  it("keeps a lone tag as audienceTag", () => {
    expect(toSelector(audience({ include: ["vip"] }))).toEqual({ audienceTag: "vip" })
  })

  it("joins several starting tags by any/all", () => {
    expect(toSelector(audience({ include: ["vip", "retail"] }))).toEqual({
      audienceRules: {
        combinator: "and",
        conditions: [
          {
            type: "group",
            combinator: "or",
            conditions: [
              { type: "tag", operator: "has", value: "vip" },
              { type: "tag", operator: "has", value: "retail" },
            ],
          },
        ],
      },
    })
    const all = toSelector(audience({ include: ["vip", "retail"], match: "all" }))
    expect(all && "audienceRules" in all && all.audienceRules.conditions[0]).toMatchObject({ combinator: "and" })
  })

  it("adds required and excluded tags", () => {
    expect(
      toSelector(audience({ include: ["diwali"], refine: { vip: "require", "sent-2-oct": "exclude" } }))
    ).toEqual({
      audienceRules: {
        combinator: "and",
        conditions: [
          { type: "tag", operator: "has", value: "diwali" },
          { type: "tag", operator: "has", value: "vip" },
          { type: "tag", operator: "not_has", value: "sent-2-oct" },
        ],
      },
    })
  })

  // Excluding a starting tag would empty the audience by construction.
  it("ignores a refinement on a starting tag", () => {
    expect(toSelector(audience({ include: ["vip"], refine: { vip: "exclude" } }))).toEqual({ audienceTag: "vip" })
  })
})

describe("baseTagSelector", () => {
  it("drops refinements", () => {
    expect(baseTagSelector(audience({ include: ["vip"], refine: { x: "exclude" } }))).toEqual({ audienceTag: "vip" })
  })
})

describe("describeTagAudience", () => {
  it("reads like the filter", () => {
    expect(
      describeTagAudience(
        audience({ include: ["vip", "retail"], refine: { wholesale: "require", "sent-2-oct": "exclude" } })
      )
    ).toBe("vip or retail · also wholesale · not sent-2-oct")
  })
})

describe("fromRules", () => {
  it("round-trips what toSelector writes", () => {
    const a = audience({ include: ["vip", "retail"], match: "all", refine: { x: "require", y: "exclude" } })
    const sel = toSelector(a)
    expect(sel && "audienceRules" in sel && fromRules(sel.audienceRules)).toEqual(a)
  })

  it("refuses rules it did not write", () => {
    expect(
      fromRules({ combinator: "or", conditions: [{ type: "tag", operator: "has", value: "vip" }] })
    ).toBeNull()
    expect(
      fromRules({
        combinator: "and",
        conditions: [{ type: "activity", operator: "active_within", days: 7 }],
      })
    ).toBeNull()
  })
})

describe("server bounds", () => {
  const tags = (n: number, p = "t") => Array.from({ length: n }, (_, i) => `${p}${i}`)
  const groupsFit = (node: { conditions?: unknown[] }): boolean =>
    !node.conditions ||
    (node.conditions.length <= MAX_GROUP_MEMBERS && node.conditions.every((c) => groupsFit(c as never)))

  // "Skip all" on a big audience used to put every skip in one group, which
  // the server refuses past 20.
  it("chunks many refinements into groups of at most 20", () => {
    const refine = Object.fromEntries(tags(45).map((t) => [t, "exclude" as const]))
    const sel = toSelector(audience({ include: ["a"], refine }))
    expect(sel && "audienceRules" in sel && groupsFit(sel.audienceRules)).toBe(true)
    expect(sel && "audienceRules" in sel && fromRules(sel.audienceRules)).toEqual(audience({ include: ["a"], refine }))
  })

  it("chunks many starting tags and still round-trips", () => {
    const a = audience({ include: tags(30, "s"), match: "all", refine: { x: "require" } })
    const sel = toSelector(a)
    expect(sel && "audienceRules" in sel && groupsFit(sel.audienceRules)).toBe(true)
    expect(sel && "audienceRules" in sel && fromRules(sel.audienceRules)).toEqual(a)
  })

  it("counts the tags a filter uses", () => {
    expect(filterTagCount(audience({ include: ["a", "b"], refine: { a: "exclude", c: "require" } }))).toBe(3)
    expect(MAX_FILTER_TAGS).toBe(50)
  })
})
