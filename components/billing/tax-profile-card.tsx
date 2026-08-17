"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "react-hot-toast"
import { getErrorMessage } from "@/lib/errors"
import { getTaxProfile, setTaxProfile, type TaxProfile } from "@/services/api"

/**
 * Invoicing details, and what tax a top-up will attract because of them.
 *
 * These are the customer's own particulars — unlike the markup, which is ours.
 * A GSTIN here is what puts their registration on the invoice, which is what
 * lets them claim input credit on what we charge, so the form says that rather
 * than presenting it as an optional extra field.
 */
export function TaxProfileCard({ accountId }: { accountId: string | null | undefined }) {
  const [profile, setProfile] = useState<TaxProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [legalName, setLegalName] = useState("")
  const [gstin, setGstin] = useState("")
  const [taxState, setTaxState] = useState("")
  const [taxCountry, setTaxCountry] = useState("IN")
  const [billingAddress, setBillingAddress] = useState("")

  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const res = await getTaxProfile(accountId)
      setProfile(res)
      setLegalName(res.legalName ?? "")
      setGstin(res.gstin ?? "")
      setTaxState(res.taxState ?? "")
      setTaxCountry(res.taxCountry || "IN")
      setBillingAddress(res.billingAddress ?? "")
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

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
      setProfile(res)
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
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
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
