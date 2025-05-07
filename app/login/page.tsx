"use client"

import { useState } from "react"
import LoginForm from "@/components/login-form"
import SignupForm from "@/components/signup-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login")

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === "login" ? "Super Admin Login" : "Create Account"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {activeTab === "login" ? "Sign in to access your dashboard" : "Register a new admin account"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <LoginForm />
          </TabsContent>

          <TabsContent value="signup">
            <SignupForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
