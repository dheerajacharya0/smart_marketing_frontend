import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "url"

export default defineConfig({
  // tsconfig sets `jsx: "preserve"` because Next runs its own transform, which
  // leaves vitest with JSX it cannot parse. The plugin transforms it for tests
  // rather than changing tsconfig, which would be changing the build to suit
  // the tests.
  plugins: [react()],
  test: {
    // `node` stays the default: the pure-logic suites are the bulk of this and
    // a DOM per file costs startup for nothing. Component tests opt in with a
    // `@vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})
