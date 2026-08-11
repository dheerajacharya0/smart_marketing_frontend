import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

// Phase 0 #3 / Phase 2 — ESLint flat config (ESLint 9 + eslint-config-next 15).
// `next/core-web-vitals` = Next's recommended rule set. Kept intentionally small;
// tighten rules as the lint gate moves toward blocking.
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Cosmetic-only: apostrophes/quotes in JSX text. Not a correctness issue,
      // and escaping every one hurts readability. Disabled so the lint gate
      // blocks on real problems, not typography.
      "react/no-unescaped-entities": "off",
      // Keep dead-code and hook-deps visible as warnings without failing the
      // build; tighten to "error" as the codebase is cleaned up.
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
]

export default eslintConfig
