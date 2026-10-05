// Node's own Blob/Response, not jsdom's: jsdom's Blob isn't a body Node's
// Response can read, which is a test-environment artifact, not browser
// behaviour. `window` is stubbed so the module sees a browser.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearCachedMedia, readCachedMedia, writeCachedMedia } from "./media-device-cache"

function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  return {
    stores,
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        match: async (key: string) => store.get(key)?.clone(),
        put: async (key: string, res: Response) => void store.set(key, res),
      }
    }),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  }
}

beforeEach(() => {
  vi.stubGlobal("window", globalThis)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("media device cache", () => {
  it("does nothing, and never throws, where Cache Storage is missing", async () => {
    vi.stubGlobal("caches", undefined)
    await expect(writeCachedMedia("m1", "acc", new Blob(["x"]))).resolves.toBeUndefined()
    await expect(readCachedMedia("m1", "acc")).resolves.toBeNull()
    await expect(clearCachedMedia()).resolves.toBeUndefined()
  })

  it("keeps a file per account and returns it on the next read", async () => {
    vi.stubGlobal("caches", fakeCaches())
    await writeCachedMedia("m1", "acc-a", new Blob(["photo"], { type: "image/jpeg" }))

    const hit = await readCachedMedia("m1", "acc-a")
    expect(await hit?.text()).toBe("photo")
    // Another account on the same device never sees it.
    expect(await readCachedMedia("m1", "acc-b")).toBeNull()
  })

  it("forgets everything on sign-out", async () => {
    vi.stubGlobal("caches", fakeCaches())
    await writeCachedMedia("m1", "acc-a", new Blob(["photo"]))
    await clearCachedMedia()
    expect(await readCachedMedia("m1", "acc-a")).toBeNull()
  })

  it("treats a storage error as a miss, not a failure", async () => {
    vi.stubGlobal("caches", { open: vi.fn().mockRejectedValue(new Error("quota")), delete: vi.fn() })
    await expect(readCachedMedia("m1", "acc")).resolves.toBeNull()
    await expect(writeCachedMedia("m1", "acc", new Blob(["x"]))).resolves.toBeUndefined()
  })
})
