import { toast } from "react-hot-toast"

/**
 * Copy with a toast either way.
 *
 * `navigator.clipboard` is absent on an insecure origin and rejects when the
 * page isn't focused, so the failure path is real rather than defensive — and it
 * has to say something, because a Copy button that silently does nothing reads
 * as a broken button rather than a blocked permission.
 *
 * Returns whether it worked, for callers that show a transient "Copied" state.
 */
export async function copyToClipboard(value: string, what = "Copied"): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error("no clipboard")
    await navigator.clipboard.writeText(value)
    toast.success(`${what} copied`)
    return true
  } catch {
    toast.error("Couldn't copy — select it and copy manually")
    return false
  }
}
