import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LoadFailedProps {
  /** What couldn't be loaded, in the user's words: "Couldn't load your contacts". */
  message: string
  onRetry?: () => void
  className?: string
}

/**
 * The state for a read that failed — deliberately not an `EmptyState`.
 *
 * An empty state is a claim ("you have no contacts", "no number connected")
 * and people act on it: re-run onboarding, re-import a list, chase consent
 * that was never missing. A failed request supports no such claim, so it gets
 * its own wording and a way to try again.
 */
export function LoadFailed({ message, onRetry, className }: LoadFailedProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 py-6 text-center", className)}>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
