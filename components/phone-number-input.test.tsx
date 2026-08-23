// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { PhoneNumberInput } from "./phone-number-input"

/**
 * Regression cover for the parts of this input that live in component state.
 *
 * Everything here failed at least once in a browser and none of it was
 * reachable from the `lib/phone-number` tests: the rules being exercised are
 * about *which* reading of an ambiguous paste wins, and that decision needs
 * the picker's country, the previous field contents, and the distinction
 * between typing and pasting — all component state.
 */

afterEach(cleanup)

/** Wrapper holding the value, like every real call site does. */
function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <PhoneNumberInput id="phone" value={value} onChange={setValue} showErrorWhileTyping />
      <output data-testid="value">{value}</output>
    </>
  )
}

const field = () => screen.getByRole("textbox") as HTMLInputElement
const submitted = () => screen.getByTestId("value").textContent
const countryButton = () => screen.getByRole("combobox")

/** A paste lands as one input event carrying the whole string. */
function paste(text: string) {
  fireEvent.change(field(), { target: { value: text } })
}

/** Typing arrives one character at a time, which the input treats differently. */
function type(text: string) {
  for (const char of text) {
    fireEvent.change(field(), { target: { value: field().value + char } })
  }
}

describe("submitting", () => {
  it("emits bare digits with the country code, never a + or a separator", () => {
    render(<Harness />)
    type("9828636666")
    expect(submitted()).toBe("919828636666")
  })

  it("reads a pasted + number and moves the picker to its country", () => {
    render(<Harness />)
    paste("+1 (415) 555-2671")
    expect(submitted()).toBe("14155552671")
    expect(countryButton().textContent).toContain("+1")
  })

  it("strips this country's own code off a pasted wa_id", () => {
    render(<Harness />)
    paste("919828636666")
    expect(submitted()).toBe("919828636666")
    expect(countryButton().textContent).toContain("+91")
  })

  it("leaves a national number that merely starts with the country code alone", () => {
    // 91… is a legitimate opening for an Indian mobile; stripping it here
    // would corrupt a number that was already correct.
    render(<Harness />)
    paste("9198765432")
    expect(submitted()).toBe("919198765432")
  })
})

describe("the nine-digit typo this input exists to catch", () => {
  it("is rejected, and the message names the country", () => {
    render(<Harness />)
    type("982863666")
    expect(submitted()).toBe("91982863666")
    expect(screen.getByText(/not a valid phone number for India/i)).toBeTruthy()
  })

  it("is not quietly relocated to the country where it happens to be valid", () => {
    // `982863666` is a valid *Iranian* number. Reading pasted digits as
    // international wherever they validate turns the one case that must fail
    // into one that passes, so the picker must not move on its own.
    render(<Harness />)
    paste("982863666")
    expect(countryButton().textContent).toContain("+91")
    expect(screen.getByText(/not a valid phone number for India/i)).toBeTruthy()
  })
})

describe("a paste carrying a different country's code", () => {
  it("does not stack one country code on another silently", () => {
    // India's plan accepts 11-digit numbers beginning with 1, so `91` stacked
    // on a US number is itself valid — no error would ever be shown for a
    // number that cannot be delivered. The offer below is what covers it.
    render(<Harness />)
    paste("14155552671")
    expect(screen.getByRole("button", { name: /read it as \+1 instead/i })).toBeTruthy()
  })

  it("applies the offered reading in one click", () => {
    render(<Harness />)
    paste("14155552671")
    fireEvent.click(screen.getByRole("button", { name: /read it as \+1 instead/i }))
    expect(submitted()).toBe("14155552671")
    expect(countryButton().textContent).toContain("+1")
  })

  it("offers rather than takes — nothing moves until the offer is clicked", () => {
    render(<Harness />)
    paste("14155552671")
    expect(countryButton().textContent).toContain("+91")
    expect(submitted()).toBe("9114155552671")
  })

  it("makes no offer when the paste is unambiguous for the selected country", () => {
    render(<Harness />)
    paste("9828636666")
    expect(screen.queryByRole("button", { name: /read it as/i })).toBeNull()
  })
})

describe("typing is never second-guessed", () => {
  it("does not move the country mid-number", () => {
    // Reinterpreting per keystroke would relocate someone at the seventh digit,
    // because a half-typed national number passes for a complete one somewhere.
    render(<Harness />)
    type("14155552671")
    expect(countryButton().textContent).toContain("+91")
  })

  it("makes no offer while typing", () => {
    render(<Harness />)
    type("14155552671")
    expect(screen.queryByRole("button", { name: /read it as/i })).toBeNull()
  })
})

describe("loading an existing value", () => {
  it("splits a stored waId into the picker and the national field", () => {
    render(<Harness initial="14155552671" />)
    expect(countryButton().textContent).toContain("+1")
    expect(field().value.replace(/\D/g, "")).toBe("4155552671")
  })

  it("does not rewrite a stored number whose country cannot be resolved", () => {
    // Splitting yields no country, so recomposing against the fallback would
    // emit a *different* number — silently editing a contact by opening it.
    const onChange = vi.fn()
    render(<PhoneNumberInput value="9991234567" onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()
  })
})
