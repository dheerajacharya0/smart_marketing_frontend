"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export function BackButton({
  /** Takes over the click instead of the default history pop — a caller
   * with its own sub-view open (a form, a panel) can close that first. */
  onClick,
}: {
  onClick?: () => void
}) {
  const router = useRouter()
  return (
    <Button variant="ghost" size="sm" onClick={onClick ?? (() => router.back())}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Back
    </Button>
  )
}
