// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { useFreshLoad } from "@/hooks/use-fresh-load"

/**
 * The editor pages seed from this, so its three outcomes must stay apart:
 * a failed read is not "nothing there", and inputs not known yet are not
 * "loaded".
 */

afterEach(cleanup)

describe("useFreshLoad", () => {
  it("reports loading, not empty, while its inputs aren't known", () => {
    const { result } = renderHook(() => useFreshLoad<string>(null, "k"))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("loads", async () => {
    const { result } = renderHook(() => useFreshLoad(() => Promise.resolve("drip"), "k"))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe("drip")
    expect(result.current.error).toBeNull()
  })

  it("keeps a failure as an error, with no data", async () => {
    const err = new Error("network down")
    const { result } = renderHook(() => useFreshLoad(() => Promise.reject(err), "k"))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(err)
    expect(result.current.data).toBeNull()
  })

  it("retries and clears the error", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce("drip")
    const { result } = renderHook(() => useFreshLoad(load, "k"))
    await waitFor(() => expect(result.current.error).toBeTruthy())

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data).toBe("drip"))
    expect(result.current.error).toBeNull()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("ignores an older request that lands after the key changed", async () => {
    let resolveFirst: (v: string) => void = () => {}
    const first = new Promise<string>((r) => (resolveFirst = r))
    const { result, rerender } = renderHook(
      ({ k, p }: { k: string; p: Promise<string> }) => useFreshLoad(() => p, k),
      { initialProps: { k: "a", p: first } },
    )

    rerender({ k: "b", p: Promise.resolve("second") })
    await waitFor(() => expect(result.current.data).toBe("second"))

    await act(async () => resolveFirst("first"))
    expect(result.current.data).toBe("second")
  })

  it("fetches again on every mount instead of reusing a previous answer", async () => {
    const load = vi.fn().mockResolvedValue("drip")
    const one = renderHook(() => useFreshLoad(load, "k"))
    await waitFor(() => expect(one.result.current.loading).toBe(false))
    one.unmount()

    const two = renderHook(() => useFreshLoad(load, "k"))
    expect(two.result.current.loading).toBe(true)
    await waitFor(() => expect(two.result.current.loading).toBe(false))
    expect(load).toHaveBeenCalledTimes(2)
  })
})
