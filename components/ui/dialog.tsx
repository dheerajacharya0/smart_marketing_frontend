"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Every floating layer a dialog can hold (Select in popper mode, Popover,
 * DropdownMenu) renders inside this wrapper, portalled outside the dialog.
 */
const NESTED_LAYER_SELECTOR = "[data-radix-popper-content-wrapper]"

/**
 * Whether a dropdown was open when the current pointer went down.
 *
 * On touch, Radix defers a dialog's "pointer down outside" to the tap's
 * `click`, so a scroll doesn't count as one. By then the dropdown the tap was
 * aimed at — picking an option, or tapping away to dismiss it — has already
 * closed and unmounted, the dialog is the top layer again, and it closes too.
 * Read at pointerdown, in the capture phase, before any layer reacts: a tap
 * that began with a dropdown open belongs to that dropdown.
 */
function useNestedLayerOpenAtPointerDown() {
  const openAtDown = React.useRef(false)
  React.useEffect(() => {
    const onPointerDown = () => {
      openAtDown.current = document.querySelector(NESTED_LAYER_SELECTOR) !== null
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    return () => document.removeEventListener("pointerdown", onPointerDown, true)
  }, [])
  return openAtDown
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /**
     * Below `sm`, render as a bottom sheet (default). Off for a dialog that
     * lays itself out full-screen on a phone, like the command palette.
     */
    mobileSheet?: boolean
  }
>(({ className, children, onPointerDownOutside, mobileSheet = true, ...props }, ref) => {
  const nestedLayerOpenAtDown = useNestedLayerOpenAtPointerDown()
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6",
          // Without these a tall dialog (the campaign wizard, the CSV import)
          // ran off the top and bottom of a phone screen with nothing to scroll,
          // putting its own footer buttons out of reach. The width keeps a gutter
          // so it reads as a dialog rather than a full-bleed page — expressed as
          // `w-`, not `max-w-`, because callers override `max-w-*` (2xl, 3xl) and
          // tailwind-merge would drop whichever of the two landed first.
          "max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto",
          // `overflow-y-auto` quietly makes x scrollable too, and an implicit
          // grid column grows to its widest child. Together, one wide row (a
          // date input, a long unbroken value) let the whole sheet pan sideways
          // under a finger. Pin the column to the sheet and never scroll on x.
          "grid-cols-[minmax(0,1fr)] overflow-x-hidden",
          "surface-float rounded-xl",
          "duration-base ease-out-soft data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[46%] data-[state=open]:slide-in-from-top-[46%]",
          // A phone gets a bottom sheet: the actions land in thumb reach instead
          // of mid-screen, and it rises from the edge it's anchored to. Media
          // variants are emitted after the plain ones, so these win below `sm`
          // without fighting callers' `max-w-*` / `max-h-*`.
          mobileSheet && [
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0",
            "max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=closed]:slide-out-to-bottom-full",
          ],
          className,
        )}
        onPointerDownOutside={(event) => {
          onPointerDownOutside?.(event)
          if (nestedLayerOpenAtDown.current) event.preventDefault()
        }}
        {...props}
      >
        {/* The sheet's grab handle. Decorative: the sheet closes by the X, the
            overlay or Escape, same as the dialog it is on a wider screen. */}
        {mobileSheet && (
          <div aria-hidden className="-mt-3 mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
        )}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-lg font-semibold leading-tight tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
