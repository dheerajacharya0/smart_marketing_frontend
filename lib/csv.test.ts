import { describe, expect, it } from "vitest"
import { parseCsv, parseCsvLine, serializeCsvLine, toCsv, withTags } from "./csv"

describe("parseCsvLine / serializeCsvLine", () => {
  it("round-trips quoted commas and quotes", () => {
    const fields = ["a,b", 'say "hi"', "plain"]
    expect(parseCsvLine(serializeCsvLine(fields))).toEqual(fields)
  })
})

describe("parseCsv", () => {
  it("finds the number column under any accepted name", () => {
    expect(parseCsv("Name,WhatsApp\nA,91").phoneIndex).toBe(1)
    expect(parseCsv("name,wa id\nA,91").phoneIndex).toBe(1)
    expect(parseCsv("name,city\nA,Pune").phoneIndex).toBe(-1)
  })
})

describe("withTags", () => {
  it("adds a tags column when the file has none", () => {
    const out = withTags(parseCsv("phone,name\n911,A\n912,B"), ["diwali", "new"])
    expect(out.header).toEqual(["phone", "name", "tags"])
    expect(out.rows).toEqual([
      ["911", "A", "diwali;new"],
      ["912", "B", "diwali;new"],
    ])
  })

  // The import merges tags, so a row's own tags must survive.
  it("merges into an existing tags column without duplicates", () => {
    const out = withTags(parseCsv("phone,Tags\n911,vip|diwali\n912,"), ["diwali"])
    expect(out.rows).toEqual([
      ["911", "vip;diwali"],
      ["912", "diwali"],
    ])
  })

  it("pads short rows before writing the tag", () => {
    const out = withTags(parseCsv("phone,name,city\n911"), ["x"])
    expect(out.rows[0]).toEqual(["911", "", "", "x"])
  })

  it("leaves the file alone with no tags", () => {
    const parsed = parseCsv("phone\n911")
    expect(withTags(parsed, [])).toBe(parsed)
  })

  it("serialises back to CSV", () => {
    expect(toCsv(withTags(parseCsv("phone,name\n911,\"Doe, J\""), ["a"]))).toBe(
      'phone,name,tags\n911,"Doe, J",a'
    )
  })
})

describe("file edge cases", () => {
  // Excel's "CSV UTF-8" starts with a byte-order mark.
  it("drops a byte-order mark from the first header", () => {
    const p = parseCsv("\uFEFFphone,name\n911,A")
    expect(p.header[0]).toBe("phone")
    expect(p.phoneIndex).toBe(0)
  })

  // An address typed over two lines in a cell must stay one row.
  it("keeps a quoted line break inside one field", () => {
    const p = parseCsv('phone,note\n911,"line1\nline2"\n912,ok')
    expect(p.rows).toEqual([
      ["911", "line1\nline2"],
      ["912", "ok"],
    ])
    expect(toCsv(p)).toBe('phone,note\n911,"line1\nline2"\n912,ok')
  })

  it("reads semicolon- and tab-separated files and writes commas", () => {
    expect(parseCsv("phone;name\n911;A").rows).toEqual([["911", "A"]])
    expect(parseCsv("phone\tname\n911\tA").phoneIndex).toBe(0)
    expect(toCsv(parseCsv('phone;name\n911;"Doe, J"'))).toBe('phone,name\n911,"Doe, J"')
  })

  it("does not mistake a comma inside quotes for the delimiter", () => {
    expect(parseCsv('"a,b";phone\nx;911').phoneIndex).toBe(1)
  })

  it("handles CRLF, trailing blank lines and a header-only file", () => {
    expect(parseCsv("phone\r\n911\r\n\r\n").rows).toEqual([["911"]])
    expect(parseCsv("phone,name\n").rows).toEqual([])
    expect(parseCsv("").header).toEqual([])
  })
})
