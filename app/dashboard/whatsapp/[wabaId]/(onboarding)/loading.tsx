import { OnboardingFrame, OptionListSkeleton, StepCard } from "@/components/onboarding/onboarding-ui"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * One loading.tsx for the whole (onboarding) group — Next falls back to the
 * nearest ancestor for any step under here without its own, so step-1
 * through step-4 all land on this. step-1/step-2 are genuinely option-picker
 * lists (a business, a WhatsApp account — see their own `OptionListSkeleton`
 * usage): `FormSkeleton`'s labeled-field-plus-Save/Cancel-footer shape was
 * wrong for them. Reuses the real `OnboardingFrame`/`StepCard`/
 * `OptionListSkeleton` building blocks (the frame's title and stepper render
 * for real here, not faked) rather than approximating them.
 *
 * step-3 and step-4 don't share that option-list shape (step-3 is a plain
 * form, step-4 a summary) — left as the one compromise here rather than
 * four separate files, because both are normally reached by client-side
 * navigation from an already-mounted step, not a fresh page load, so this
 * fallback rarely actually surfaces for them in practice.
 */
export default function Loading() {
  return (
    <OnboardingFrame>
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>
      <StepCard>
        <OptionListSkeleton label="Loading…" />
      </StepCard>
    </OnboardingFrame>
  )
}
