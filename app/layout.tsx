import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "react-hot-toast"
import { GlobalErrorHandlers } from "@/components/global-error-handlers"
import { QueryProvider } from "@/components/query-provider"
import { WebVitals } from "@/components/web-vitals"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "WhatsApp Admin Dashboard",
  description: "WhatsApp Web-inspired admin dashboard for managing Facebook users and WhatsApp Business Accounts",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GlobalErrorHandlers />
        <WebVitals />
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="light">
            {children}
          </ThemeProvider>
        </QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
