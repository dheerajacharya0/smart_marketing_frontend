"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TemplateComponent } from "@/lib/whatsapp-template"

interface TemplateLike {
  components?: TemplateComponent[]
}

// Reads the BODY component's {{1}}..{{N}} placeholders — highest index wins.
export function templateBodyText(template: TemplateLike): string {
  const body = (template?.components || []).find((c) => c.type === "BODY")
  return body?.text || ""
}

export function countTemplateVariables(template: TemplateLike): number {
  let max = 0
  for (const m of templateBodyText(template).matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    max = Math.max(max, Number(m[1]))
  }
  return max
}

// One input per template body variable, each with a personalization-token
// insert menu. Shared by the campaign wizard and drip step editor.
export function TemplateParamsInput({
  template,
  values,
  onChange,
  attributeKeys = [],
  idPrefix = "param",
}: {
  template: TemplateLike
  values: string[]
  onChange: (values: string[]) => void
  attributeKeys?: string[]
  idPrefix?: string
}) {
  const count = countTemplateVariables(template)
  if (count === 0) {
    return <p className="text-xs text-muted-foreground">This template has no variables to fill in.</p>
  }

  const setAt = (index: number, value: string) => {
    const next = [...values]
    while (next.length < count) next.push("")
    next[index] = value
    onChange(next.slice(0, count))
  }

  const insertToken = (index: number, token: string) => {
    setAt(index, (values[index] || "") + token)
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="grid gap-1">
          <Label htmlFor={`${idPrefix}-${i}`} className="text-xs">{`Variable {{${i + 1}}}`}</Label>
          <div className="flex gap-2">
            <Input
              id={`${idPrefix}-${i}`}
              value={values[i] || ""}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder="Static text or token"
              className="flex-1 h-9"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0">
                  Token <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => insertToken(i, "{{name}}")}>
                  Contact name — {"{{name}}"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertToken(i, "{{waId}}")}>
                  Phone — {"{{waId}}"}
                </DropdownMenuItem>
                {attributeKeys.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Attributes</DropdownMenuLabel>
                    {attributeKeys.map((key) => (
                      <DropdownMenuItem key={key} onClick={() => insertToken(i, `{{attributes.${key}}}`)}>
                        {key} — {`{{attributes.${key}}}`}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  )
}
