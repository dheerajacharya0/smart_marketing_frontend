import { describe, expect, it } from "vitest"
import {
  ALLOWED_MIME,
  MAX_BYTES,
  categoryForFile,
  checkMediaFile,
  formatBytes,
} from "./media-upload"

const file = (type: string, size: number, name = "f") => ({ name, type, size })

describe("categoryForFile", () => {
  it("maps every allowed MIME back to its own category", () => {
    // A type listed under a category must not resolve to a different one, or the
    // upload is sent with a `type` the server will reject.
    for (const [category, mimes] of Object.entries(ALLOWED_MIME)) {
      for (const mime of mimes) {
        expect(categoryForFile({ type: mime })).toBe(category)
      }
    }
  })

  it("calls webp a sticker, not an image", () => {
    // Both are image/* to a browser; only one is a sticker to Meta, and the
    // per-category size limits differ by 10x.
    expect(categoryForFile({ type: "image/webp" })).toBe("sticker")
    expect(categoryForFile({ type: "image/png" })).toBe("image")
  })

  it("tolerates a charset parameter and odd casing", () => {
    expect(categoryForFile({ type: "text/plain; charset=utf-8" })).toBe("document")
    expect(categoryForFile({ type: "IMAGE/JPEG" })).toBe("image")
  })

  it("returns null for a type WhatsApp can't carry", () => {
    // Refused by name rather than uploaded as a "document" that fails at Meta.
    expect(categoryForFile({ type: "image/gif" })).toBeNull()
    expect(categoryForFile({ type: "application/zip" })).toBeNull()
    expect(categoryForFile({ type: "" })).toBeNull()
    expect(categoryForFile({})).toBeNull()
  })
})

describe("checkMediaFile", () => {
  it("passes a file inside its category limit", () => {
    expect(checkMediaFile(file("image/jpeg", 2 * 1024 * 1024))).toEqual({
      category: "image",
      error: null,
    })
  })

  it("rejects at the boundary of each category", () => {
    for (const [category, max] of Object.entries(MAX_BYTES)) {
      const mime = ALLOWED_MIME[category as keyof typeof ALLOWED_MIME][0]
      expect(checkMediaFile(file(mime, max))?.error).toBeNull()
      const over = checkMediaFile(file(mime, max + 1))
      expect(over?.category).toBe(category)
      expect(over?.error).toBeTruthy()
    }
  })

  it("names the actual limit and the actual size in the error", () => {
    // The point of checking client-side is that the message can say why before
    // anything is uploaded.
    const result = checkMediaFile(file("image/png", 6 * 1024 * 1024))
    expect(result?.error).toContain("5MB")
    expect(result?.error).toContain("6MB")
  })

  it("rejects an empty file", () => {
    expect(checkMediaFile(file("application/pdf", 0))?.error).toBe("That file is empty.")
  })

  it("returns null — not an error — for an unsupported type", () => {
    // Null means "not media we can send at all", which is a different message
    // from "too big"; the caller shows each one differently.
    expect(checkMediaFile(file("application/zip", 10))).toBeNull()
  })
})

describe("formatBytes", () => {
  it("scales to the unit a human would use", () => {
    expect(formatBytes(500)).toBe("500 bytes")
    expect(formatBytes(2048)).toBe("2KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5MB")
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5MB")
  })
})
