import { buildLlmsTxt } from "@/lib/llms-txt"

// Rendered once at build time: every input is a constant.
export const dynamic = "force-static"

export function GET() {
  return new Response(buildLlmsTxt(), {
    // text/plain, not text/markdown: browsers download text/markdown instead
    // of showing it, and crawlers read both. Most llms.txt files use this.
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
