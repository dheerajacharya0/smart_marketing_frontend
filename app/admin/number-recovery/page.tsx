"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Phone, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getErrorMessage } from "@/lib/errors"
import {
  adminConfirmNumberRecovery,
  getAdminOrphanedWabaPhoneNumbers,
  getAdminOrphanedWhatsappAccounts,
  type AdminOrphanedWabaPhoneNumber,
  type AdminOrphanedWabaSummary,
} from "@/services/api"

/**
 * Platform-admin-only tool, unlinked from any nav — bookmark-only, same
 * "ops tool, not a customer page" positioning as the backend endpoints
 * behind it (AdminGuard). Not gated client-side beyond requiring a session:
 * every call here 403s for anyone whose account isn't a platform admin, and
 * the error from that 403 is what this page actually shows as the gate.
 *
 * Finishes the one case self-service number recovery can't:
 * confirmNumberRecovery's ALREADY_VERIFIED_NO_SELF_SERVICE dead end, where
 * Meta already verified an orphaned WABA's number but the customer's own
 * Facebook business doesn't list it, so there's no way to prove ownership
 * without a human reading the support ticket first.
 */
export default function AdminNumberRecoveryPage() {
  const [loadingWabas, setLoadingWabas] = useState(false)
  const [wabaError, setWabaError] = useState<string | null>(null)
  const [wabas, setWabas] = useState<AdminOrphanedWabaSummary[] | null>(null)
  const [checked, setChecked] = useState<number | null>(null)

  const [selectedWaba, setSelectedWaba] = useState<AdminOrphanedWabaSummary | null>(null)
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  const [numbersError, setNumbersError] = useState<string | null>(null)
  const [numbers, setNumbers] = useState<AdminOrphanedWabaPhoneNumber[] | null>(null)

  const [selectedNumber, setSelectedNumber] = useState<AdminOrphanedWabaPhoneNumber | null>(null)
  const [accountId, setAccountId] = useState("")
  const [pin, setPin] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{ wabaId: string; phoneNumberId: string } | null>(null)

  const loadWabas = async () => {
    setLoadingWabas(true)
    setWabaError(null)
    try {
      const result = await getAdminOrphanedWhatsappAccounts()
      setWabas(result.orphaned)
      setChecked(result.checked)
    } catch (err) {
      setWabaError(getErrorMessage(err, "Couldn't load orphaned WABAs"))
      setWabas(null)
    } finally {
      setLoadingWabas(false)
    }
  }

  const selectWaba = async (waba: AdminOrphanedWabaSummary) => {
    setSelectedWaba(waba)
    setSelectedNumber(null)
    setConfirmed(null)
    setConfirmError(null)
    setNumbers(null)
    setNumbersError(null)
    setLoadingNumbers(true)
    try {
      const result = await getAdminOrphanedWabaPhoneNumbers(waba.id)
      setNumbers(result)
    } catch (err) {
      setNumbersError(getErrorMessage(err, "Couldn't load this WABA's numbers"))
    } finally {
      setLoadingNumbers(false)
    }
  }

  const selectNumber = (number: AdminOrphanedWabaPhoneNumber) => {
    setSelectedNumber(number)
    setConfirmed(null)
    setConfirmError(null)
    setAccountId("")
    setPin("")
  }

  const needsPin = selectedNumber?.platform_type !== "CLOUD_API"

  const submitConfirm = async () => {
    if (!selectedWaba || !selectedNumber || !accountId.trim() || confirming) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const result = await adminConfirmNumberRecovery({
        accountId: accountId.trim(),
        wabaId: selectedWaba.id,
        phoneNumberId: selectedNumber.id,
        ...(pin.trim() ? { pin: pin.trim() } : {}),
      })
      setConfirmed(result)
    } catch (err) {
      setConfirmError(getErrorMessage(err, "Couldn't finish the recovery"))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Number recovery (admin)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Finishes a support ticket self-service recovery couldn&apos;t: an orphaned WABA Meta
          already verified, where the customer&apos;s own Facebook business doesn&apos;t list it.
          Confirm ownership from the ticket yourself before using this — it skips the OTP and
          Facebook checks the customer-facing flow has.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Orphaned WABAs</CardTitle>
            <CardDescription>
              Shared with Converszio&apos;s Business Portfolio at Meta, with no matching row here.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={loadWabas} disabled={loadingWabas}>
            {loadingWabas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {wabas ? "Refresh" : "Load"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {wabaError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{wabaError}</AlertDescription>
            </Alert>
          )}
          {checked !== null && (
            <p className="text-xs text-muted-foreground">
              {checked} WABA{checked === 1 ? "" : "s"} shared, {wabas?.length ?? 0} orphaned.
            </p>
          )}
          {wabas && wabas.length === 0 && (
            <p className="text-sm text-muted-foreground">No orphaned WABAs right now.</p>
          )}
          {wabas && wabas.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>WABA id</TableHead>
                  <TableHead className="text-right">Numbers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wabas.map((waba) => (
                  <TableRow
                    key={waba.id}
                    className={selectedWaba?.id === waba.id ? "bg-muted/50" : undefined}
                  >
                    <TableCell>{waba.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{waba.id}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => selectWaba(waba)}>
                        {loadingNumbers && selectedWaba?.id === waba.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "View numbers"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedWaba && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Numbers on {selectedWaba.name || selectedWaba.id}</CardTitle>
            <CardDescription>Pick the number the support ticket is about.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {numbersError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{numbersError}</AlertDescription>
              </Alert>
            )}
            {numbers && numbers.length === 0 && (
              <p className="text-sm text-muted-foreground">Meta reports no numbers on this WABA.</p>
            )}
            {numbers && numbers.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Verified name</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Pick</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.map((n) => (
                    <TableRow
                      key={n.id}
                      className={selectedNumber?.id === n.id ? "bg-muted/50" : undefined}
                    >
                      <TableCell className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {n.display_phone_number || n.id}
                      </TableCell>
                      <TableCell>{n.verified_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={n.platform_type === "CLOUD_API" ? "secondary" : "outline"}>
                          {n.platform_type || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => selectNumber(n)}>
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {selectedWaba && selectedNumber && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Finish recovery for {selectedNumber.display_phone_number || selectedNumber.id}
            </CardTitle>
            <CardDescription>
              Links it to the target account exactly as if Embedded Signup had completed cleanly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {confirmed ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Done — WABA {confirmed.wabaId} / number {confirmed.phoneNumberId} linked and
                  subscribed.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="admin-recovery-account">Target account id</Label>
                  <Input
                    id="admin-recovery-account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="UUID of the account from the support ticket"
                    className="font-mono text-xs"
                  />
                </div>
                {needsPin && (
                  <div className="grid gap-2">
                    <Label htmlFor="admin-recovery-pin">
                      6-digit PIN <span className="text-muted-foreground">(not on the Cloud API yet)</span>
                    </Label>
                    <Input
                      id="admin-recovery-pin"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="max-w-[160px] font-mono"
                    />
                  </div>
                )}
                {confirmError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{confirmError}</AlertDescription>
                  </Alert>
                )}
                <Button onClick={submitConfirm} disabled={confirming || !accountId.trim()}>
                  {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm recovery
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
