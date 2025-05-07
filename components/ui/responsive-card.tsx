import type * as React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ResponsiveCardProps {
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
}

export function ResponsiveCard({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
}: ResponsiveCardProps) {
  return (
    <Card className={cn("w-full overflow-hidden shadow-sm border-border/40", className)}>
      {(title || description) && (
        <CardHeader className={cn("p-4 sm:p-6", headerClassName)}>
          {title && (typeof title === "string" ? <CardTitle>{title}</CardTitle> : title)}
          {description &&
            (typeof description === "string" ? <CardDescription>{description}</CardDescription> : description)}
        </CardHeader>
      )}
      <CardContent className={cn("p-4 sm:p-6", !title && !description && "pt-4 sm:pt-6", contentClassName)}>
        {children}
      </CardContent>
      {footer && (
        <CardFooter className={cn("flex flex-wrap gap-2 p-4 sm:p-6 border-t", footerClassName)}>{footer}</CardFooter>
      )}
    </Card>
  )
}
