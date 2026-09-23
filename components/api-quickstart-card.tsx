"use client"

import { useMemo, useState } from "react"
import { Check, Copy, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { API_BASE_URL } from "@/config/api-config"
import { copyToClipboard } from "@/lib/copy-to-clipboard"
import { KEY_HEADER, KEY_SCOPE, buildQuickstart, type QuickstartExample } from "@/lib/api-quickstart"
import { useWhatsappPhoneNumbers } from "@/hooks/use-queries"

/**
 * The missing half of the keys card: what to do with the key once it's copied.
 *
 * Deliberately three requests and a scope list rather than a reference — see the
 * note at the top of `lib/api-quickstart.ts` for why an endpoint list doesn't
 * belong in the frontend. The ids in the snippets are the viewer's real ones, so
 * the first call works without editing anything but the key.
 */

/** `label` is what the button reads; `what` names the thing in the toast. */
function CopyButton({ value, label, what }: { value: string; label: string; what: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 gap-1.5 px-2 text-xs"
      onClick={async () => {
        if (await copyToClipboard(value, what)) {
          setCopied(true)
          // Long enough to register, short enough that a second copy of the
          // same snippet still shows feedback.
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  )
}

/** One labelled, copyable value — base URL and auth header. */
function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    // `min-w-0`: a grid item defaults to `min-width: auto`, so the nowrap code
    // below would widen its column to fit the URL instead of scrolling inside
    // it — which on a phone pushes the whole page sideways.
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton value={value} label="Copy" what={label} />
      </div>
      <code className="block overflow-x-auto whitespace-nowrap rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-xs">
        {value}
      </code>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Example({ example }: { example: QuickstartExample }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{example.title}</p>
          <p className="text-xs text-muted-foreground">{example.purpose}</p>
        </div>
        {/* The snippet below is pretty-printed for reading; what gets copied is
            one line, so it survives a paste into PowerShell or cmd, where a
            trailing backslash is not a line continuation. */}
        <CopyButton value={example.curl} label="Copy as curl" what="Command" />
      </div>
      <code className="block overflow-x-auto rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-xs">
        <span className="text-muted-foreground">{example.method}</span> {example.url}
      </code>
      {example.body !== undefined && (
        <pre className="overflow-x-auto rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-xs">
          {JSON.stringify(example.body, null, 2)}
        </pre>
      )}
      {example.note && <p className="text-xs text-muted-foreground">{example.note}</p>}
    </div>
  )
}

export function ApiQuickstartCard({ accountId }: { accountId: string | null | undefined }) {
  const { data: numbers, isLoading } = useWhatsappPhoneNumbers(accountId)

  // A registered number is the one with a phoneNumberId you can actually send
  // from. `displayPhoneNumber` may be null on a freshly onboarded account, which
  // is why the recipient falls back to a placeholder instead of being required.
  const sender = useMemo(
    () => (Array.isArray(numbers) ? numbers.find((n) => n.status === "registered") : undefined),
    [numbers],
  )

  const examples = useMemo(
    () =>
      accountId
        ? buildQuickstart({
            accountId,
            phoneNumberId: sender?.phoneNumberId,
            to: sender?.displayPhoneNumber,
          })
        : [],
    [accountId, sender],
  )

  if (!accountId) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Using your key
        </CardTitle>
        <CardDescription>
          Your first request, with your own account id already filled in — swap in the key and run
          it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base URL" value={API_BASE_URL} />
          <Field
            label="Authentication"
            value={`${KEY_HEADER}: wsk_YOUR_KEY`}
            hint="Send it on every request. Anyone holding it can act on this account."
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {!sender && (
              <p className="text-sm text-muted-foreground">
                Register a WhatsApp number to see the sending examples — until then a key can still
                report sales.
              </p>
            )}
            {examples.map((example) => (
              <Example key={example.id} example={example} />
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">What a key can do</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {KEY_SCOPE.allowed.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            {/* Stated plainly because the alternative is a customer building
                against an endpoint that will 401 them forever. */}
            <p className="text-sm font-medium">Dashboard only — a key can&apos;t reach these</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {KEY_SCOPE.denied.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Every response carries <code className="rounded bg-muted px-1">X-RateLimit-Limit</code>{" "}
            and <code className="rounded bg-muted px-1">X-RateLimit-Remaining</code>, so you can
            pace a batch job before it runs out. Going over returns{" "}
            {/* `code`, not `Badge` — Badge renders a div, and a div inside this
                paragraph is invalid HTML and a hydration error. */}
            <code className="rounded bg-muted px-1">429</code> with a{" "}
            <code className="rounded bg-muted px-1">Retry-After</code> in seconds.
          </p>
          <p>
            A rejected key always answers <em>Invalid API key</em>, whether it was mistyped, revoked
            or expired — check the key list below before assuming which.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
