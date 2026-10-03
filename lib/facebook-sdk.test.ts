// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_FACEBOOK_APP_ID: "app",
    NEXT_PUBLIC_FACEBOOK_ES_CONFIG_ID: "config",
    NEXT_PUBLIC_FACEBOOK_GRAPH_VERSION: "v22.0",
  },
}))

/**
 * Meta does not order the session message (which number was picked) and the
 * FB.login callback (the code). Either may come first; a missing message must
 * not hang the flow.
 */

const SESSION = JSON.stringify({
  type: "WA_EMBEDDED_SIGNUP",
  event: "FINISH",
  data: { waba_id: "111", phone_number_id: "222" },
})

function postFromFacebook(data: unknown, origin = "https://www.facebook.com") {
  window.dispatchEvent(new MessageEvent("message", { data, origin }))
}

type LoginCb = (r: { authResponse: { code?: string } | null; status: string }) => void

function installFB(onLogin: (cb: LoginCb) => void) {
  window.FB = { init: vi.fn(), login: vi.fn((cb: LoginCb) => onLogin(cb)) }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  delete window.FB
})

describe("launchEmbeddedSignup", () => {
  it("returns the picked number when the session message arrives first", async () => {
    installFB((cb) => {
      postFromFacebook(SESSION)
      cb({ authResponse: { code: "c1" }, status: "connected" })
    })
    const { launchEmbeddedSignup } = await import("./facebook-sdk")
    await expect(launchEmbeddedSignup()).resolves.toEqual({
      code: "c1",
      wabaId: "111",
      phoneNumberId: "222",
    })
  })

  it("waits briefly for a session message that arrives after the callback", async () => {
    installFB((cb) => {
      cb({ authResponse: { code: "c2" }, status: "connected" })
      setTimeout(() => postFromFacebook(SESSION), 200)
    })
    const { launchEmbeddedSignup } = await import("./facebook-sdk")
    await expect(launchEmbeddedSignup()).resolves.toEqual({
      code: "c2",
      wabaId: "111",
      phoneNumberId: "222",
    })
  })

  it("resolves with only the code when no session message ever comes", async () => {
    vi.useFakeTimers()
    installFB((cb) => cb({ authResponse: { code: "c3" }, status: "connected" }))
    const { launchEmbeddedSignup } = await import("./facebook-sdk")
    const pending = launchEmbeddedSignup()
    await vi.advanceTimersByTimeAsync(1600)
    await expect(pending).resolves.toEqual({ code: "c3" })
  })

  it("ignores a session posted by a non-Facebook origin", async () => {
    vi.useFakeTimers()
    installFB((cb) => {
      postFromFacebook(SESSION, "https://evil.example")
      cb({ authResponse: { code: "c4" }, status: "connected" })
    })
    const { launchEmbeddedSignup } = await import("./facebook-sdk")
    const pending = launchEmbeddedSignup()
    await vi.advanceTimersByTimeAsync(1600)
    await expect(pending).resolves.toEqual({ code: "c4" })
  })

  it("rejects on cancel and stops listening", async () => {
    const remove = vi.spyOn(window, "removeEventListener")
    installFB((cb) => cb({ authResponse: null, status: "unknown" }))
    const { launchEmbeddedSignup } = await import("./facebook-sdk")
    await expect(launchEmbeddedSignup()).rejects.toThrow(/cancelled/)
    expect(remove).toHaveBeenCalledWith("message", expect.any(Function))
  })
})
