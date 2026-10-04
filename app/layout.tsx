import type React from "react"
import type { Metadata, Viewport } from "next"
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
  // Launching from an iPhone Home Screen opens full-screen instead of in a
  // Safari tab — and only then does iOS expose Web Push (see lib/web-push.ts).
  appleWebApp: { capable: true, title: "Converszio", statusBarStyle: "default" },
}

// `cover` lets the page draw under a phone's notch and gesture bar, which is
// what makes `env(safe-area-inset-*)` non-zero — the tab bar and bottom sheets
// pad themselves with it. The theme colour here is only the first paint;
// ThemeColorSync in theme-provider keeps it matched to the active palette.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f7fafd",
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
