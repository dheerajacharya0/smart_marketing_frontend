import { describe, expect, it } from "vitest"
import { brandCss, brandTokens, hexToHsl, isHexColor, luminance } from "./brand-color"

const hsl = (token: string) => {
  const [h, s, l] = token.replace(/%/g, "").split(" ").map(Number)
  return { h, s, l }
}

describe("hexToHsl", () => {
  it("converts primaries and greys", () => {
    expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50 })
    expect(hexToHsl("#0000ff")).toEqual({ h: 240, s: 100, l: 50 })
    expect(hexToHsl("#808080")).toEqual({ h: 0, s: 0, l: 50 })
  })
})

describe("isHexColor", () => {
  it("accepts #rrggbb only", () => {
    expect(isHexColor("#1a2b3c")).toBe(true)
    expect(isHexColor("#abc")).toBe(false)
    expect(isHexColor("red")).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })
})

describe("brandTokens", () => {
  it("keeps the picked hue for the primary", () => {
    const { light, dark } = brandTokens("#7c3aed")
    expect(hsl(light["--primary"]).h).toBe(hexToHsl("#7c3aed").h)
    expect(hsl(dark["--primary"]).h).toBe(hexToHsl("#7c3aed").h)
  })

  it("is lighter in dark mode, so it reads on a dark ground", () => {
    const { light, dark } = brandTokens("#0f766e")
    expect(hsl(dark["--primary"]).l).toBeGreaterThan(hsl(light["--primary"]).l)
  })

  it("gives a near-grey pick enough colour to read as a brand", () => {
    const { light } = brandTokens("#777777")
    expect(hsl(light["--primary"]).s).toBeGreaterThanOrEqual(35)
  })

  it("never pairs a pale primary with white text", () => {
    // A pastel yellow: bright enough that white on it would be unreadable.
    const { light, dark } = brandTokens("#fde047")
    for (const set of [light, dark]) {
      const primary = hsl(set["--primary"])
      if (luminance(primary) > 0.4) expect(set["--primary-foreground"]).not.toBe("0 0% 100%")
    }
  })

  it("only puts white text on a primary dark enough for 4.5:1", () => {
    for (const hex of ["#06b6d4", "#22c55e", "#2563eb", "#e11d48", "#f59e0b", "#7c3aed"]) {
      const { light, dark } = brandTokens(hex)
      for (const set of [light, dark]) {
        const lum = luminance(hsl(set["--primary"]))
        const white = set["--primary-foreground"] === "0 0% 100%"
        const contrast = white ? 1.05 / (lum + 0.05) : (lum + 0.05) / 0.06
        expect(contrast).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("clamps a very dark pick so the light primary is still a colour, not black", () => {
    const { light } = brandTokens("#050510")
    expect(hsl(light["--primary"]).l).toBeGreaterThanOrEqual(34)
  })
})

describe("brandCss", () => {
  it("scopes both modes behind data-brand", () => {
    const css = brandCss("#2563eb")
    expect(css).toContain("html[data-brand][data-brand]{--primary:")
    expect(css).toContain("html.dark[data-brand][data-brand]{--primary:")
  })
})
