import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "text-sm font-medium",
    // Colour and elevation move on hover; the press moves the button itself.
    "transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out-soft",
    "active:translate-y-px",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-emphasis hover:shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:brightness-95 hover:shadow-sm",
        outline:
          "border border-border bg-surface-2/60 text-foreground shadow-xs hover:border-border-strong hover:bg-accent/60",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        /** Tinted, low-weight primary — for secondary actions that are still brand. */
        soft: "bg-primary-soft text-primary-emphasis hover:bg-primary-soft/70",
        ghost: "text-foreground-secondary hover:bg-accent/70 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:text-primary-emphasis hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-md px-6",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
