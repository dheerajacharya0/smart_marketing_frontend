import type { ReactNode } from "react"
import { ThemeProvider } from "@/components/theme-provider"

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">{children}</div>
    </ThemeProvider>
  )
}
