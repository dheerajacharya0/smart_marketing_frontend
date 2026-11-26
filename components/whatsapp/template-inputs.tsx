"use client"

import { AlertTriangle, ChevronDown } from "lucide-react"
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
import type { TemplateInputValues, TemplateSpec } from "@/lib/template-spec"

/**
 * Every value a template needs, in one place: its header variable, its body
 * variables (numbered or named) and the endings of its variable URL buttons.
 * A media header is not here — each form already owns a picker for that.
 *
 * Shared by the campaign wizard, drip steps, automation template actions and
 * the inbox, so a template that needs something can't be sent from one of
 * them without being asked for it.
 *
 * `allowTokens` adds the per-contact token menu ({{name}}, attributes). The
 * inbox sends to one known person, so it types plain values instead.
 */
export function TemplateInputsFields({
  spec,
  values,
  onChange,
  attributeKeys = [],
  allowTokens = true,
  idPrefix = "tpl",
}: {
  spec: TemplateSpec
  values: TemplateInputValues
  onChange: (values: TemplateInputValues) => void
  attributeKeys?: string[]
  allowTokens?: boolean
  idPrefix?: string
}) {
  if (spec.unsupported.length) {
    return (
      <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This template has {spec.unsupported.join(", ")}, which can&apos;t be filled in here yet. Pick a
          template without it.
        </p>
      </div>
    )
  }

  const headerToken = spec.header.kind === "text" ? spec.header.token : null
  const setBody = (i: number, v: string) =>
    onChange({ ...values, bodyParameters: values.bodyParameters.map((x, j) => (j === i ? v : x)) })
  const setButton = (i: number, v: string) =>
    onChange({ ...values, buttonParameters: values.buttonParameters.map((x, j) => (j === i ? v : x)) })

  if (!headerToken && spec.body.tokens.length === 0 && spec.urlButtons.length === 0) {
    return <p className="text-xs text-muted-foreground">This template has no variables to fill in.</p>
  }

  return (
    <div className="space-y-3">
      {allowTokens && (
        <p className="text-sm text-muted-foreground">
          Type text, or insert a token that&apos;s filled in for each contact.
        </p>
      )}

      {headerToken && (
        <Field
          id={`${idPrefix}-header`}
          label={`Header ${"{{"}${headerToken}${"}}"}`}
          value={values.headerText}
          placeholder={spec.headerExample ? `e.g. ${spec.headerExample}` : "Header value"}
          onChange={(v) => onChange({ ...values, headerText: v })}
          allowTokens={allowTokens}
          attributeKeys={attributeKeys}
        />
      )}

      {spec.body.tokens.map((token, i) => (
        <Field
          key={`b-${token}`}
          id={`${idPrefix}-body-${i}`}
          label={`Variable ${"{{"}${token}${"}}"}`}
          value={values.bodyParameters[i] ?? ""}
          placeholder={spec.body.examples[i] ? `e.g. ${spec.body.examples[i]}` : allowTokens ? "Static text or token" : "Value"}
          onChange={(v) => setBody(i, v)}
          allowTokens={allowTokens}
          attributeKeys={attributeKeys}
        />
      ))}

      {spec.urlButtons.map((button, i) => (
        <Field
          key={`u-${button.index}`}
          id={`${idPrefix}-button-${i}`}
          label={`"${button.text}" button link`}
          hint={`Fills the end of ${button.url}`}
          value={values.buttonParameters[i] ?? ""}
          placeholder="e.g. order-123"
          onChange={(v) => setButton(i, v)}
          allowTokens={allowTokens}
          attributeKeys={attributeKeys}
        />
      ))}
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  value,
  placeholder,
  onChange,
  allowTokens,
  attributeKeys,
}: {
  id: string
  label: string
  hint?: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  allowTokens: boolean
  attributeKeys: string[]
}) {
  const insert = (token: string) => onChange(value + token)
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1"
        />
        {allowTokens && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 shrink-0">
                Token <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => insert("{{name}}")}>Contact name: {"{{name}}"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => insert("{{waId}}")}>Phone: {"{{waId}}"}</DropdownMenuItem>
              {attributeKeys.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Attributes</DropdownMenuLabel>
                  {attributeKeys.map((key) => (
                    <DropdownMenuItem key={key} onClick={() => insert(`{{attributes.${key}}}`)}>
                      {key}: {`{{attributes.${key}}}`}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {hint && <p className="break-all text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
