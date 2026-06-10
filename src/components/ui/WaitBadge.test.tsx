// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { formatFrames } from "#/lib/format"
import { WaitBadge } from "./WaitBadge"

describe("WaitBadge", () => {
  it("renders null when priorGate is 0", () => {
    const { container } = render(<WaitBadge priorGate={0} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders +0.Xs with a wait tooltip, muted styling", () => {
    const { container } = render(<WaitBadge priorGate={43} />)
    const span = container.querySelector("span")!
    expect(span.textContent).toBe(`+${formatFrames(43)}`)
    expect(span.getAttribute("title")).toBe(`wait ${formatFrames(43)}`)
    expect(span.className).toContain("text-xs")
    expect(span.className).toContain("text-muted-foreground")
  })

  it("appends a passed className", () => {
    const { container } = render(<WaitBadge priorGate={43} className="ml-1" />)
    expect(container.querySelector("span")!.className).toContain("ml-1")
  })
})
