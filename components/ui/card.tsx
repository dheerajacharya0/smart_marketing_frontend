import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * One card family, eight jobs. A page that uses the same rectangle for a KPI,
 * a chart, a warning and a nav shortcut reads as a template; picking the right
 * variant is what gives a screen its hierarchy.
 *
 *   default     — the everyday panel
 *   elevated    — lifted off the page; use for the section that leads
 *   soft        — a washed tonal block for supporting information
 *   highlight   — the one thing on the page that matters most
 *   interactive — clickable; lifts and lights its hairline on hover
 *   analytics   — chart/metric container, tuned for dense numeric content
 *   glass       — translucent; reserve for overlays and hero widgets
 *   minimal     — no chrome at all, just rhythm and spacing
 */
const cardVariants = cva("text-card-foreground", {
  variants: {
    variant: {
      default: "rounded-lg border border-border-subtle bg-card shadow-sm",
      elevated: "rounded-lg border border-border-subtle bg-surface-2 shadow-md",
      soft: "rounded-lg border border-border-subtle/70 bg-muted/50",
      highlight: "surface-highlight",
      interactive:
        "surface-interactive focus-ring cursor-pointer rounded-lg border border-border-subtle bg-card shadow-sm",
      analytics:
        "rounded-lg border border-border-subtle bg-card shadow-sm bg-surface-sheen",
      glass: "surface-glass",
      minimal: "rounded-lg",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 p-5 sm:p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      // Confident, not oversized — headings earn attention through weight and
      // spacing rather than scale.
      className={cn("font-display text-lg font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 p-5 pt-0 sm:p-6 sm:pt-0", className)}
      {...props}
    />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
