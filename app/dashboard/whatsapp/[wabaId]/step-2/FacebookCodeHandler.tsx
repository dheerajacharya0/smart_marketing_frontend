"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

// Import your function here
import { handleFacebookCallback } from "@/services/api"

export default function FacebookCodeHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      // Define and call an async function inside useEffect
      const sendCode = async () => {
        await handleFacebookCallback(code)
      }
      sendCode()
    }
  }, [searchParams])

  return null
}
