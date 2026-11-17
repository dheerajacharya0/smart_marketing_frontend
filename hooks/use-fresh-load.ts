"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * A one-shot read that is deliberately NOT cached — for seeding an editor.
 *
 * A query cache would hand an editor the copy it saw last visit until a
 * refetch lands, and an editor that seeds its form once would then save that
 * stale copy over newer work. So: fetch on every mount, and keep the three
 * outcomes apart — loading, failed, loaded — instead of folding a failure into
 * "nothing there". `load` is null while its inputs aren't known yet (that is
 * "loading", not "empty").
 *
 * `key` must change whenever `load` would fetch something different.
 */
export function useFreshLoad<T>(load: (() => Promise<T>) | null, key: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!load) return
    let cancelled = false
    setLoading(true)
    setError(null)
    load()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // `key` stands in for `load`, which is a new closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, Boolean(load)])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, error, loading: load ? loading : true, retry }
}
