// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { TemplateInputsFields } from "./template-inputs"
import { EMPTY_TEMPLATE_INPUTS, fitTemplateInputs, templateSpec } from "@/lib/template-spec"

afterEach(cleanup)

const FULL = templateSpec({
  components: [
    { type: "HEADER", format: "TEXT", text: "Hi {{1}},", example: { header_text: ["Mate"] } },
    { type: "BODY", text: "Order {{order_id}} ships {{day}}" },
    { type: "BUTTONS", buttons: [{ type: "URL", text: "Track", url: "https://t.test/{{1}}" }] },
  ],
})

describe("TemplateInputsFields", () => {
  it("asks for the header variable, named body variables and the button link", () => {
    render(
      <TemplateInputsFields spec={FULL} values={fitTemplateInputs(FULL, {})} onChange={vi.fn()} />
    )
    expect(screen.getByLabelText("Header {{1}}")).toBeTruthy()
    expect(screen.getByPlaceholderText("e.g. Mate")).toBeTruthy()
    expect(screen.getByLabelText("Variable {{order_id}}")).toBeTruthy()
    expect(screen.getByLabelText("Variable {{day}}")).toBeTruthy()
    expect(screen.getByLabelText('"Track" button link')).toBeTruthy()
    expect(screen.getByText("Fills the end of https://t.test/{{1}}")).toBeTruthy()
  })

  it("reports each edit in the right slot", () => {
    const onChange = vi.fn()
    render(<TemplateInputsFields spec={FULL} values={fitTemplateInputs(FULL, {})} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("Header {{1}}"), { target: { value: "Asha" } })
    expect(onChange).toHaveBeenLastCalledWith({ headerText: "Asha", bodyParameters: ["", ""], buttonParameters: [""] })
    fireEvent.change(screen.getByLabelText("Variable {{day}}"), { target: { value: "Mon" } })
    expect(onChange).toHaveBeenLastCalledWith({ headerText: "", bodyParameters: ["", "Mon"], buttonParameters: [""] })
    fireEvent.change(screen.getByLabelText('"Track" button link'), { target: { value: "A1" } })
    expect(onChange).toHaveBeenLastCalledWith({ headerText: "", bodyParameters: ["", ""], buttonParameters: ["A1"] })
  })

  it("offers per-contact tokens only where they resolve", () => {
    const { rerender } = render(
      <TemplateInputsFields spec={FULL} values={fitTemplateInputs(FULL, {})} onChange={vi.fn()} />
    )
    expect(screen.getAllByText("Token").length).toBe(4)
    rerender(
      <TemplateInputsFields spec={FULL} values={fitTemplateInputs(FULL, {})} onChange={vi.fn()} allowTokens={false} />
    )
    expect(screen.queryByText("Token")).toBeNull()
  })

  it("says plainly when a template can't be filled here", () => {
    const spec = templateSpec({ components: [{ type: "BUTTONS", buttons: [{ type: "COPY_CODE", text: "Copy" }] }] })
    render(<TemplateInputsFields spec={spec} values={EMPTY_TEMPLATE_INPUTS} onChange={vi.fn()} />)
    expect(screen.getByText(/a coupon-code button, which can't be filled in here yet/)).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("says when there's nothing to fill", () => {
    render(
      <TemplateInputsFields
        spec={templateSpec({ components: [{ type: "BODY", text: "Hello" }] })}
        values={EMPTY_TEMPLATE_INPUTS}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText("This template has no variables to fill in.")).toBeTruthy()
  })
})
