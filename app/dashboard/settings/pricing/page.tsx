"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "react-hot-toast"
import { getErrorMessage, getErrorStatus } from "@/lib/errors"
import { useAccountId } from "@/hooks/use-account-id"
import {
  getMarkupSettings,
  setAccountMarkup,
  setGlobalMarkup,
  type MarkupSettings,
} from "@/services/api"

/**
 * Pricing configuration — an **ops screen**, not a customer one.
 *
 * Reading the markup is allowed for the account owner, but writing it is
 * platform-admin only and the frontend has no way to know which the signed-in
 * user is: auth returns no role, so the 403 is the only signal there is. The
 * controls are therefore always present and a rejected save says plainly that
 * the account isn't a platform admin, rather than being hidden behind a guess.
 *
 * Deliberately not linked from the navigation: what we charge over Meta's cost
 * is our margin, and whether to show a customer their own markup is a product
 * decision, not a layout one.
 */
export default function PricingSettingsPage() {
  const { accountId, resolved } = useAccountId()
  const [settings, setSettings] = useState<MarkupSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [accountInput, setAccountInput] = useState("")
  const [globalInput, setGlobalInput] = useState("")
  const [savingAccount, setSavingAccount] = useState(false)
  const [savingGlobal, setSavingGlobal] = useState(false)

  const fetchSettings = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMarkupSettings(accountId)
      setSettings(res)
      setAccountInput(res.accountPercent != null ? String(res.accountPercent) : "")
      setGlobalInput(String(res.globalPercent))
    } catch (err) {
      setLoadError(getErrorMessage(err) || "Couldn't load pricing")
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const reportWriteError = (err: unknown, fallback: string) => {
    if (getErrorStatus(err) === 403) {
      toast.error("Only a platform admin can change pricing.")
      return
    }
    toast.error(getErrorMessage(err) || fallback)
  }

  const handleSaveAccount = async (clear = false) => {
    if (!accountId) return
    // Empty means "follow the global default" and is sent as null. Zero is a
    // different thing entirely — a deliberate at-cost rate — so the two must
    // not collapse into each other on the way out.
    const value = clear || accountInput.trim() === "" ? null : Number(accountInput)
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 1000)) {
      toast.error("Markup must be between 0 and 1000 percent")
      return
    }
    setSavingAccount(true)
    try {
      const res = await setAccountMarkup(accountId, value)
      setSettings(res)
      setAccountInput(res.accountPercent != null ? String(res.accountPercent) : "")
      toast.success(value == null ? "Override cleared" : "Account markup updated")
    } catch (err) {
      reportWriteError(err, "Failed to update markup")
    } finally {
      setSavingAccount(false)
    }
  }

  const handleSaveGlobal = async () => {
    const value = Number(globalInput)
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      toast.error("Markup must be between 0 and 1000 percent")
      return
    }
    setSavingGlobal(true)
    try {
      await setGlobalMarkup(value)
      toast.success("Default markup updated")
      fetchSettings()
    } catch (err) {
      reportWriteError(err, "Failed to update the default")
    } finally {
      setSavingGlobal(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" asChild className="mr-2">
          <Link href="/dashboard/settings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Settings
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Pricing</h1>
      </div>

      {resolved && !accountId ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No connected account yet.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : loadError ? (
        <div className="rounded-md border p-8 text-center text-destructive">{loadError}</div>
      ) : settings ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What this account pays</CardTitle>
              <CardDescription>
                Charged on top of what Meta bills us, on every message.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Effective markup</p>
                <p className="text-2xl font-bold">{settings.effectivePercent}%</p>
                <p className="text-xs text-muted-foreground">
                  {settings.accountPercent != null ? "negotiated rate" : "following the default"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform default</p>
                <p className="text-2xl font-bold">{settings.globalPercent}%</p>
                <p className="text-xs text-muted-foreground">
                  env floor {settings.envDefaultPercent}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Input tax</p>
                <p className="text-2xl font-bold">{settings.inputTaxPercent}%</p>
                {/* Not a second markup: this is GST on Meta's invoice that we
                    can't reclaim, so it's cost, and the markup compounds over
                    it rather than beside it. */}
                <p className="text-xs text-muted-foreground">unreclaimable, so it counts as cost</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Override for this account</CardTitle>
              <CardDescription>
                Leave blank to follow the platform default. Zero is a real value — an at-cost rate —
                and is not the same as blank.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="account-markup">Markup %</Label>
                  <Input
                    id="account-markup"
                    type="number"
                    min={0}
                    max={1000}
                    step="0.01"
                    value={accountInput}
                    onChange={(e) => setAccountInput(e.target.value)}
                    placeholder={String(settings.globalPercent)}
                    className="w-32"
                  />
                </div>
                <Button onClick={() => handleSaveAccount()} disabled={savingAccount}>
                  {savingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
                {settings.accountPercent != null && (
                  <Button
                    variant="outline"
                    onClick={() => handleSaveAccount(true)}
                    disabled={savingAccount}
                  >
                    Clear override
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Applies from the next charge. Charges already made keep the rate they were billed
                at — every wallet entry stores its own markup, so history isn&apos;t restated.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform default</CardTitle>
              <CardDescription>
                Moves every account that doesn&apos;t have an override of its own.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="global-markup">Markup %</Label>
                  <Input
                    id="global-markup"
                    type="number"
                    min={0}
                    max={1000}
                    step="0.01"
                    value={globalInput}
                    onChange={(e) => setGlobalInput(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button onClick={handleSaveGlobal} disabled={savingGlobal}>
                  {savingGlobal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save default
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Platform admins only — everyone else gets a 403 here.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
