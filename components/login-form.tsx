"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loginWithEmail, loginWithOtp, sendOtp } from "@/services/api"

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [error, setError] = useState("")

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Email and password are required")
      return
    }

    setIsLoading(true)

    try {
      // Call the login API
      await loginWithEmail(email, password)

      // Redirect to dashboard on success
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOtp = async () => {
    if (!otpEmail) {
      setError("Email is required to send OTP")
      return
    }

    setIsLoading(true)

    try {
      // Call the send OTP API
      await sendOtp(otpEmail)
      setIsOtpSent(true)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!otpEmail || !otp) {
      setError("Email and OTP are required")
      return
    }

    setIsLoading(true)

    try {
      // Call the OTP login API
      await loginWithOtp(otpEmail, otp)

      // Redirect to dashboard on success
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Tabs defaultValue="email" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">Email/Password</TabsTrigger>
        <TabsTrigger value="otp">OTP</TabsTrigger>
      </TabsList>

      {error && <div className="p-3 mt-4 text-sm text-white bg-red-500 rounded-md">{error}</div>}

      <TabsContent value="email">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="otp">
        <form onSubmit={handleOtpLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-otp">Email</Label>
            <Input
              id="email-otp"
              type="email"
              placeholder="admin@example.com"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              required
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleSendOtp}
            disabled={isLoading || !otpEmail}
          >
            {isLoading ? "Sending..." : isOtpSent ? "Resend OTP" : "Send OTP"}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="otp">OTP</Label>
            <Input
              id="otp"
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !isOtpSent}>
            {isLoading ? "Verifying..." : "Verify & Sign in"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  )
}
