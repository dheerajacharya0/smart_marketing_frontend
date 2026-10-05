import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

// Radix's DismissableLayer saves body.style.pointerEvents when the first modal
// layer opens and restores it when the last one closes — but that bookkeeping
// is per module copy. With vaul (the mobile "+" drawer) on its own nested copy,
// closing the drawer while a dialog opened left the restored value at "none"
// and the whole page stopped taking taps until a reload. The `resolutions`
// entry for vaul in package.json keeps it on the app's copy; this fails if an
// upgrade splits them again.
describe("radix dialog is a single copy", () => {
  it("vaul resolves the same react-dismissable-layer as the app", () => {
    const fromApp = createRequire(import.meta.url)
    const fromDialog = createRequire(fromApp.resolve("@radix-ui/react-dialog"))
    const fromVaul = createRequire(fromApp.resolve("vaul"))
    const fromVaulDialog = createRequire(fromVaul.resolve("@radix-ui/react-dialog"))

    expect(fromVaul.resolve("@radix-ui/react-dialog")).toBe(fromApp.resolve("@radix-ui/react-dialog"))
    expect(fromVaulDialog.resolve("@radix-ui/react-dismissable-layer")).toBe(
      fromDialog.resolve("@radix-ui/react-dismissable-layer"),
    )
  })
})
