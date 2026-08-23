"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  callingCodeOf,
  checkRecipient,
  digitsOf,
  flagOf,
  formatNational,
  isValidRecipient,
  listCountries,
  splitRecipient,
  type CountryCode,
} from "@/lib/phone-number"

/**
 * A WhatsApp recipient: country picker + national number.
 *
 * Two controls rather than one free text box, because a single box has to
 * guess whether leading digits are a country code and it guesses wrong on the
 * numbers that matter. Here the country is explicit, `AsYouType` formats the
 * visible national number so it stays comfortable to type, and the value handed
 * back is always bare digits including the country code — the form Meta echoes
 * as `wa_id` and the form conversation threads are keyed on.
 */

/** India first: this product's numbers are overwhelmingly Indian. */
export const DEFAULT_COUNTRY: CountryCode = "IN"

interface PhoneNumberInputProps {
  id?: string
  /** Bare digits, country code included. `""` while empty. */
  value: string
  onChange: (digits: string) => void
  /** Server-side message for this field — shown instead of the local one. */
  error?: string | null
  /**
   * Show the local "not valid" message before the field has been blurred.
   * Off by default: complaining at the third keystroke of a number that will
   * be fine by the twelfth is noise.
   */
  showErrorWhileTyping?: boolean
  disabled?: boolean
  placeholder?: string
  defaultCountry?: CountryCode
  className?: string
  onBlur?: () => void
}

export function PhoneNumberInput({
  id,
  value,
  onChange,
  error,
  showErrorWhileTyping,
  disabled,
  placeholder,
  defaultCountry = DEFAULT_COUNTRY,
  className,
  onBlur,
}: PhoneNumberInputProps) {
  const countries = useMemo(() => listCountries(), [])
  const initial = useMemo(() => splitRecipient(value), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [country, setCountry] = useState<CountryCode>(initial.country ?? defaultCountry)
  const [national, setNational] = useState(initial.country ? initial.national : digitsOf(value))
  const [touched, setTouched] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // What this component last handed the parent. Kept in a ref so the sync
  // below can tell "the parent reset the field" from "our own value came back".
  const emitted = useRef(value)

  const composed = national ? `${callingCodeOf(country)}${national}` : ""

  /**
   * Emitted only from the handlers below, never from an effect on `composed`.
   *
   * A stored number whose country the metadata can't resolve splits into
   * `{ national: <all the digits> }` with no country, which then recomposes
   * against the fallback country as something else entirely. An effect would
   * push that rewritten number straight back into the parent's state on mount
   * — silently changing a contact's number by opening its edit dialog.
   */
  const emit = (nextCountry: CountryCode, nextNational: string) => {
    const next = nextNational ? `${callingCodeOf(nextCountry)}${nextNational}` : ""
    emitted.current = next
    onChange(next)
  }

  // The parent replaced the value out from under us — a dialog opening on a
  // different contact, or a reset after save. Re-derive both halves from it.
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    const split = splitRecipient(value)
    setCountry(split.country ?? defaultCountry)
    setNational(split.country ? split.national : digitsOf(value))
    if (!value) setTouched(false)
  }, [value, defaultCountry])

  const selectCountry = (next: CountryCode) => {
    setCountry(next)
    emit(next, national)
  }

  const handleNationalChange = (raw: string) => {
    // A full international number pasted in — take the country from it rather
    // than stacking it on top of whatever the picker says.
    if (raw.trim().startsWith("+")) {
      const split = splitRecipient(raw)
      if (split.country) {
        setCountry(split.country)
        setNational(split.national)
        emit(split.country, split.national)
        return
      }
    }

    let digits = digitsOf(raw)

    // Pasted with the country code but no `+`. Only strip it when doing so
    // produces a valid number and leaving it does not — so an Indian mobile
    // that genuinely starts "91…" is left alone.
    const calling = callingCodeOf(country)
    if (digits.length > calling.length && digits.startsWith(calling)) {
      const withoutPrefix = digits.slice(calling.length)
      if (
        isValidRecipient(`${calling}${withoutPrefix}`) &&
        !isValidRecipient(`${calling}${digits}`)
      ) {
        digits = withoutPrefix
      }
    }

    setNational(digits)
    emit(country, digits)
  }

  const check = composed ? checkRecipient(composed) : null
  const localError = check && !check.valid && (touched || showErrorWhileTyping) ? check.message : null
  const shownError = error ?? localError
  const describedBy = shownError ? `${id ?? "phone"}-error` : undefined

  const selected = countries.find((c) => c.code === country)

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-stretch gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              aria-label={`Country code — ${selected?.name ?? country}`}
              disabled={disabled}
              className="w-[7.5rem] shrink-0 justify-between px-2 font-normal"
            >
              <span className="flex items-center gap-1.5 truncate">
                <span aria-hidden>{flagOf(country)}</span>
                <span className="tabular-nums">+{callingCodeOf(country)}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[18rem] p-0" align="start">
            <Command
              filter={(value, search) =>
                value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput placeholder="Search country or code" />
              <CommandList>
                <CommandEmpty>No country matches that.</CommandEmpty>
                <CommandGroup>
                  {countries.map((option) => (
                    <CommandItem
                      // cmdk matches on this value, so the calling code is
                      // searchable ("+44", "44") as well as the name.
                      key={option.code}
                      value={`${option.name} ${option.code} +${option.callingCode}`}
                      onSelect={() => {
                        selectCountry(option.code)
                        setPickerOpen(false)
                      }}
                    >
                      <span className="mr-2" aria-hidden>
                        {flagOf(option.code)}
                      </span>
                      <span className="flex-1 truncate">{option.name}</span>
                      <span className="ml-2 tabular-nums text-muted-foreground">
                        +{option.callingCode}
                      </span>
                      {option.code === country && <Check className="ml-2 h-3.5 w-3.5" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={formatNational(country, national)}
          onChange={(e) => handleNationalChange(e.target.value)}
          onBlur={() => {
            setTouched(true)
            onBlur?.()
          }}
          disabled={disabled}
          placeholder={placeholder ?? "98765 43210"}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy}
          className="flex-1"
        />
      </div>

      {shownError ? (
        <p id={describedBy} className="text-sm text-destructive">
          {shownError}
        </p>
      ) : (
        composed && (
          <p className="text-xs text-muted-foreground tabular-nums">Sends to {composed}</p>
        )
      )}
    </div>
  )
}
