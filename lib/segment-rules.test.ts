import { describe, it, expect } from "vitest"
import { parseRulesErrorIndex, emptyCondition, conditionNeedsValue, toApiGroup, fromApiGroup, isGroupDraft, countConditions, groupDepth, groupErrors, describeCondition, MAX_TOTAL_CONDITIONS, MAX_GROUP_DEPTH, type GroupDraft } from "./segment-rules"
import type { SegmentRules } from "@/services/api"

describe("parseRulesErrorIndex", () => {
  it("pulls the condition index out of a backend error", () => {
    expect(parseRulesErrorIndex("conditions.2 is invalid")).toBe(2)
    expect(parseRulesErrorIndex("conditions[0].value required")).toBe(0)
  })
  it("returns null when no index is present", () => {
    expect(parseRulesErrorIndex("bad rules")).toBeNull()
  })
})

describe("conditionNeedsValue", () => {
  it("is false for existence operators, true otherwise", () => {
    const base = emptyCondition()
    expect(conditionNeedsValue({ ...base, type: "attribute", operator: "exists" })).toBe(false)
    expect(conditionNeedsValue({ ...base, type: "attribute", operator: "not_exists" })).toBe(false)
    expect(conditionNeedsValue({ ...base, type: "attribute", operator: "equals" })).toBe(true)
  })
})

describe("nested groups", () => {
  const tagCondition = (value: string) => ({ ...emptyCondition(), type: "tag" as const, operator: "has", value })

  it("stamps type:'group' on nested groups but not the root", () => {
    // The server treats the root's `type` as optional so pre-nesting rule sets
    // still parse, but a nested group without it is indistinguishable from a
    // malformed leaf and parses as an empty group.
    const api = toApiGroup({
      combinator: "or",
      conditions: [tagCondition("vip"), { combinator: "and", conditions: [tagCondition("pune")] }],
    })
    expect(api.type).toBeUndefined()
    expect((api.conditions[1] as SegmentRules).type).toBe("group")
  })

  it("round-trips through the API shape", () => {
    const group: GroupDraft = {
      combinator: "and",
      conditions: [
        tagCondition("vip"),
        { combinator: "or", conditions: [tagCondition("pune"), tagCondition("mumbai")] },
      ],
    }
    const back = fromApiGroup(toApiGroup(group))
    expect(back.combinator).toBe("and")
    expect(back.conditions).toHaveLength(2)
    expect(isGroupDraft(back.conditions[1])).toBe(true)
    expect(toApiGroup(back)).toEqual(toApiGroup(group))
  })

  it("loads a pre-nesting flat rule set unchanged", () => {
    // Every stored segment is one of these; none of them may break.
    const flat: SegmentRules = {
      combinator: "or",
      conditions: [{ type: "tag", operator: "has", value: "vip" }],
    }
    const draft = fromApiGroup(flat)
    expect(isGroupDraft(draft.conditions[0])).toBe(false)
    expect(toApiGroup(draft)).toEqual(flat)
  })

  it("counts leaves across the whole tree, not members of the root", () => {
    const group: GroupDraft = {
      combinator: "and",
      conditions: [
        tagCondition("a"),
        { combinator: "or", conditions: [tagCondition("b"), { combinator: "and", conditions: [tagCondition("c")] }] },
      ],
    }
    expect(countConditions(group)).toBe(3)
    expect(groupDepth(group)).toBe(3)
  })

  it("reports an empty group rather than silently sending one", () => {
    // `.min(1)` server-side — an empty group 400s the whole rule set.
    const errors = groupErrors({ combinator: "and", conditions: [{ combinator: "or", conditions: [] }] })
    expect(errors.some((e) => e.includes("is empty"))).toBe(true)
  })

  it("flags a breach of the total-condition and depth caps", () => {
    const many: GroupDraft = {
      combinator: "and",
      conditions: Array.from({ length: 12 }, () => ({
        combinator: "or" as const,
        conditions: Array.from({ length: 5 }, () => tagCondition("x")),
      })),
    }
    expect(groupErrors(many).some((e) => e.includes(`${MAX_TOTAL_CONDITIONS} conditions`))).toBe(true)

    let deep: GroupDraft = { combinator: "and", conditions: [tagCondition("x")] }
    for (let i = 0; i < MAX_GROUP_DEPTH; i++) deep = { combinator: "and", conditions: [deep] }
    expect(groupErrors(deep).some((e) => e.includes("nest deeper"))).toBe(true)
  })

  it("locates a bad row by its path through the tree", () => {
    const errors = groupErrors({
      combinator: "and",
      conditions: [{ combinator: "or", conditions: [{ ...emptyCondition(), type: "tag", value: "" }] }],
    })
    expect(errors[0]).toContain("group 1")
    expect(errors[0]).toContain("row 1")
  })
})

describe("describeCondition — clicked", () => {
  it("reads as a sentence in both directions", () => {
    expect(
      describeCondition({ type: "campaign", event: "clicked", operator: "within", days: 7 })
    ).toBe("clicked a link in any campaign within 7 days")
    expect(
      describeCondition({ type: "campaign", event: "clicked", operator: "not_within", days: 7 })
    ).toBe("didn't click a link in any campaign within 7 days")
  })
})
