"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import { setTaxProfile, type TaxProfile } from "@/services/api"
import { useTaxProfile } from "@/hooks/use-queries"

/**
 * Invoicing details, and what tax a top-up will attract because of them.
 *
 * These are the customer's own particulars — unlike the markup, which is ours.
 * A GSTIN here is what puts their registration on the invoice, which is what
 * lets them claim input credit on what we charge, so the form says that rather
 * than presenting it as an optional extra field.
 */
export function TaxProfileCard({ accountId }: { accountId: string | null | undefined }) {
  const { data, isLoading, error, refetch } = useTaxProfile(accountId)
  const [saved, setSaved] = useState<TaxProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [legalName, setLegalName] = useState("")
  const [gstin, setGstin] = useState("")
  const [taxState, setTaxState] = useState("")
  const [taxCountry, setTaxCountry] = useState("IN")
  const [billingAddress, setBillingAddress] = useState("")

  // A save returns the stored row, and that answer outranks the cached fetch
  // until the query refreshes — the tax lines it carries are what the next
  // top-up will actually be charged.
  const profile = saved ?? data ?? null

  // The form must not render on a failed load: every field would be blank, and
  // a blank field saves as null, so a dropped request could talk someone into
  // overwriting their stored GSTIN and legal name with nothing — on the
  // document that has to be right. `error` being its own value is what makes
  // that check possible.
  const loadError = error ? getErrorMessage(error, "Couldn't load your invoicing details") : null

  // Seed the inputs once the row arrives. Keyed on the loaded profile rather
  // than on every render, so it can't overwrite what someone is typing.
  useEffect(() => {
    if (!data) return
    setLegalName(data.legalName ?? "")
    setGstin(data.gstin ?? "")
    setTaxState(data.taxState ?? "")
    setTaxCountry(data.taxCountry || "IN")
    setBillingAddress(data.billingAddress ?? "")
  }, [data])

  const handleSave = async () => {
    if (!accountId) return
    setSaving(true)
    try {
      // Empty means "not on file" and is sent as null rather than "", so the
      // invoice omits the line instead of printing a blank one.
      const res = await setTaxProfile({
        accountId,
        taxCountry: taxCountry.trim().toUpperCase() || "IN",
        taxState: taxState.trim() || null,
        gstin: gstin.trim() || null,
        legalName: legalName.trim() || null,
        billingAddress: billingAddress.trim() || null,
      })
      setSaved(res)
      toast.success("Invoicing details saved")
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const outputTax = profile?.outputTax

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoicing details</CardTitle>
        <CardDescription>
          What appears on your invoices, and what decides the tax on a top-up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            plain
            icon={AlertCircle}
            title="Couldn't load your invoicing details"
            description={`${loadError}. Nothing has changed — the form stays hidden so a blank field can't be saved over what's on file.`}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            {outputTax && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                {outputTax.supplierRegistered ? (
                  <>
                    <p>
                      Top-ups are taxed at <strong>{outputTax.percent}%</strong>
                      {outputTax.components.length > 0
                        ? ` (${outputTax.components.join(" + ")})`
                        : ""}
                      .
                    </p>
                    {outputTax.placeOfSupply && (
                      <p className="text-xs text-muted-foreground">
                        Place of supply: {outputTax.placeOfSupply}
                      </p>
                    )}
                    {outputTax.kind === "export_zero_rated" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Zero-rated as an export of services.
                      </p>
                    )}
                  </>
                ) : (
                  // No supplier registration configured: charging tax we aren't
                  // registered to collect would be worse than charging none.
                  <p className="text-muted-foreground">
                    No tax is charged on top-ups for this deployment.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="legal-name">Registered business name</Label>
                <Input
                  id="legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Acme Retail Private Limited"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27AAAAA0000A1Z5"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Needed to claim input credit on what we charge. It also decides the place of
                  supply, ahead of the state below.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tax-state">State</Label>
                <Input
                  id="tax-state"
                  value={taxState}
                  onChange={(e) => setTaxState(e.target.value)}
                  placeholder="Maharashtra"
                />
                <p className="text-xs text-muted-foreground">
                  Decides whether tax splits into CGST + SGST or is charged as IGST.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tax-country">Country</Label>
                <Input
                  id="tax-country"
                  value={taxCountry}
                  onChange={(e) => setTaxCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="IN"
                  className="w-24 font-mono"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="billing-address">Billing address</Label>
              <Textarea
                id="billing-address"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                rows={3}
                placeholder="Street, city, PIN"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || !accountId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save details
              </Button>
              {/* An invoice already issued keeps the details it was issued with;
                  changing them here only affects the next one. */}
              <p className="text-xs text-muted-foreground">
                Applies to future invoices — ones already issued keep what they say.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
