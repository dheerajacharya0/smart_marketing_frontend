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
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
]

export default eslintConfig
