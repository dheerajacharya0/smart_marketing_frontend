import type React from "react"
import type { Metadata } from "next"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider, paletteBootstrapScript } from "@/components/theme-provider"
import { Toaster } from "react-hot-toast"
import { GlobalErrorHandlers } from "@/components/global-error-handlers"
import { QueryProvider } from "@/components/query-provider"
import { WebVitals } from "@/components/web-vitals"

// Inter for reading, Plus Jakarta Sans for headings — a quiet pairing that
// gives the hierarchy a voice without a second personality in body copy.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
})

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
    // The font variables must live on <html>: globals.css derives
    // --font-sans/--font-display from them at :root, and a custom property
    // defined on <body> is not visible to a :root rule — which silently
    // dropped the whole type system back to Times New Roman.
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored palette before first paint — see theme-provider. */}
        <script dangerouslySetInnerHTML={{ __html: paletteBootstrapScript }} />
      </head>
      <body className="font-sans antialiased">
        <GlobalErrorHandlers />
        <WebVitals />
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
