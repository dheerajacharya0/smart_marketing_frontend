import { cn } from "@/lib/utils"

/** Two overlapping chat bubbles, blue behind teal — the Converszio mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 36" fill="none" aria-hidden="true" className={cn("h-7 w-auto sm:h-8", className)}>
      <defs>
        <linearGradient id="cz-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="cz-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path
        d="M5 3h22a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H11l-6 5v-5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"
        stroke="url(#cz-back)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M17 11h22a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3v5l-6-5H17a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3Z"
        style={{ fill: "var(--lp-bg, #ffffff)" }}
        stroke="url(#cz-front)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-landing text-[1.25rem] font-bold leading-none tracking-[-0.04em] text-lp-fg sm:text-[1.45rem]">
        converszio
      </span>
    </span>
  )
}
