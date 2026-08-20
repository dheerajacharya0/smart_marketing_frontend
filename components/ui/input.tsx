import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "h-10",
          // Soft tinted field, hairline border, and a themed focus ring with a
          // subtle glow. No hard black borders anywhere in the form system.
          "flex w-full rounded-md border border-input/70 bg-surface-2/70 px-3 py-2",
          "text-base md:text-sm text-foreground placeholder:text-muted-foreground",
          "shadow-xs transition-[border-color,box-shadow,background-color] duration-fast ease-out-soft",
          "hover:border-border-strong/70",
          "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:shadow-focus",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/50",
          "aria-[invalid=true]:border-destructive/60 aria-[invalid=true]:focus-visible:ring-destructive/30",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
