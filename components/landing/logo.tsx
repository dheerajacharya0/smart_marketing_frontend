import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * The approved Converszio logo (symbol + wordmark), used as supplied — the
 * brand guide forbids rebuilding the wordmark in a font, tracing the mark or
 * recolouring it. Never rendered under 140px wide (the guide's digital
 * minimum). On dark, `.lp-logo` in landing.css puts it in a white container.
 *
 * public/converszio-logo.png is the raster from the brand guidelines PDF;
 * swap it for the approved SVG once design hands one over.
 */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("lp-logo inline-flex items-center", className)}>
      <Image
        src="/converszio-logo.png"
        alt="Converszio"
        width={1668}
        height={282}
        priority={priority}
        className="h-auto w-[150px] sm:w-[170px]"
      />
    </span>
  )
}
