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
  countryName,
  digitsOf,
  flagOf,
  formatNational,
  isValidRecipient,
  listCountries,
  splitRecipient,
  type CountryCode,
  type CountryOption,
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

/**
 * Shown before anyone types. The metadata knows 245 countries and rendering
 * them all costs ~700ms of blocking work on open — inside a dialog, where the
 * focus trap re-scans the tree, enough to lock the tab for tens of seconds.
 * Nobody scrolls 245 rows anyway; they type. So the closed state is a
 * shortlist and the full set is reachable through the search box.
 */
const COMMON_COUNTRIES: CountryCode[] = ["IN", "US", "GB", "AE", "SG", "AU", "CA", "BR"]

/** Cap on search results — past this, the search was not specific enough. */
const MAX_RESULTS = 50

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
  const [countrySearch, setCountrySearch] = useState("")
  /**
   * A second, equally defensible reading of what was just pasted — offered,
   * never taken. See `handleNationalChange` for why nothing auto-switches.
   */
  const [alternative, setAlternative] = useState<{ country: CountryCode; national: string } | null>(
    null
  )

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
    setAlternative(null)
    emit(next, national)
  }

  /** Take the offered reading — the only thing that acts on `alternative`. */
  const acceptAlternative = () => {
    if (!alternative) return
    setCountry(alternative.country)
    setNational(alternative.national)
    emit(alternative.country, alternative.national)
    setAlternative(null)
  }

  const handleNationalChange = (raw: string) => {
    // A full international number pasted in — take the country from it rather
    // than stacking it on top of whatever the picker says.
    if (raw.trim().startsWith("+")) {
      const split = splitRecipient(raw)
      if (split.country) {
        setCountry(split.country)
        setNational(split.national)
        setAlternative(null)
        emit(split.country, split.national)
        return
      }
    }

    let digits = digitsOf(raw)

    /**
     * Bare digits are read as a national number for the selected country. A
     * leading `+` (handled above) is the only thing that means international.
     *
     * This looks like it under-reads a pasted `wa_id`, and the alternative was
     * tried and is worse. Bare digits are irreducibly ambiguous — `982863666`
     * is either an Indian mobile a digit short or a perfectly valid **Iranian**
     * number, and nothing in the string says which. A rule that reinterprets
     * whatever validates somewhere swallows exactly the typo this input exists
     * to catch, and reports success. Given a choice between refusing a good
     * number visibly and accepting a bad one silently, this refuses visibly:
     * the country sits in a control the user can see and change, and the
     * composed number is echoed under the field.
     *
     * The one unambiguous case is kept below.
     */
    const calling = callingCodeOf(country)

    /**
     * Pasted with *this* country's own code and no `+` — copying a `wa_id`
     * back into the field it came from, which is the common paste here since
     * the picker already sits on the right country.
     *
     * Safe because it is checked both ways: stripping must produce a valid
     * number and keeping the prefix must not. An Indian mobile that genuinely
     * begins "91" fails the second test and is left alone.
     *
     * Paste only. Typing must not be second-guessed mid-number — moving the
     * value under someone at the seventh digit is worse than any paste this
     * rescues.
     */
    const isPaste = digits.length - national.length > 1
    if (isPaste && digits.length > calling.length && digits.startsWith(calling)) {
      const withoutPrefix = digits.slice(calling.length)
      if (
        isValidRecipient(`${calling}${withoutPrefix}`) &&
        !isValidRecipient(`${calling}${digits}`)
      ) {
        digits = withoutPrefix
      }
    }

    /**
     * Offer the international reading rather than taking it.
     *
     * Taking it silently swallows a typo — `982863666` is both an Indian
     * mobile a digit short and a valid Iranian number. Ignoring it entirely
     * leaves one silent failure: a US `wa_id` pasted while the picker is on
     * India composes to `9114155552671`, which India's plan *accepts*, so no
     * error is ever shown for a number that will never reach anyone.
     *
     * A one-click alternative resolves both. The typo still errors against the
     * selected country; the misfiled paste is one click from correct; and
     * nothing changes under the user without them asking.
     */
    const reading = isPaste && isValidRecipient(digits) ? splitRecipient(digits) : null
    setAlternative(
      reading?.country && reading.country !== country
        ? { country: reading.country, national: reading.national }
        : null
    )

    setNational(digits)
    emit(country, digits)
  }

  const check = composed ? checkRecipient(composed) : null
  const localError = check && !check.valid && (touched || showErrorWhileTyping) ? check.message : null
  const shownError = error ?? localError
  const describedBy = shownError ? `${id ?? "phone"}-error` : undefined

  const selected = countries.find((c) => c.code === country)

  /**
   * Filtering is done here rather than by cmdk so the *rendered* list can be
   * short. cmdk's own filter hides non-matches but still mounts every item,
   * which is the cost this is avoiding — hence `shouldFilter={false}` below.
   *
   * Matches name, ISO code and calling code, with or without the `+`, so "44",
   * "+44", "gb" and "united" all find the same row.
   */
  const visibleCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase().replace(/^\+/, "")
    if (!query) {
      const shortlist = [country, ...COMMON_COUNTRIES.filter((c) => c !== country)]
      return shortlist
        .map((code) => countries.find((c) => c.code === code))
        .filter((c): c is CountryOption => Boolean(c))
    }
    return countries
      .filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.code.toLowerCase() === query ||
          c.callingCode.startsWith(query)
      )
      .slice(0, MAX_RESULTS)
  }, [countries, countrySearch, country])

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-stretch gap-2">
        {/* `modal` is load-bearing when this input sits inside a Dialog, which
            is where most of its uses are. `PopoverContent` is portalled to
            `body`, i.e. outside the dialog's DOM subtree, so without it the
            dialog reads the very first pointerdown on this trigger as an
            outside interaction and dismisses itself — the picker could not be
            opened at all from the contact form. Modal mode puts the popover on
            the dismissable-layer stack above the dialog instead. */}
        <Popover
          modal
          open={pickerOpen}
          onOpenChange={(next) => {
            setPickerOpen(next)
            if (!next) setCountrySearch("")
          }}
        >
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
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search country or code"
                value={countrySearch}
                onValueChange={setCountrySearch}
              />
              <CommandList>
                <CommandEmpty>No country matches that.</CommandEmpty>
                <CommandGroup
                  heading={countrySearch.trim() ? undefined : "Common"}
                >
                  {visibleCountries.map((option) => (
                    <CommandItem
                      key={option.code}
                      value={option.code}
                      onSelect={() => {
                        selectCountry(option.code)
                        setPickerOpen(false)
                        setCountrySearch("")
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

      {alternative && (
        <button
          type="button"
          onClick={acceptAlternative}
          className="text-xs text-primary underline underline-offset-2 hover:no-underline"
        >
          {/* Phrased as "a number in X" rather than "an X number": country
              names are not adjectives, and "a Iran number" is what the
              obvious wording produces. */}
          Looks like a number in {countryName(alternative.country)} — read it as +
          {callingCodeOf(alternative.country)} instead
        </button>
      )}
    </div>
  )
}
