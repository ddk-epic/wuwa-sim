// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { ResourceValue } from "./ResourceValue"

function renderValue(node: React.ReactElement): HTMLSpanElement {
  const { container } = render(node)
  return container.querySelector("span")!
}

describe("ResourceValue", () => {
  it("renders a plain value below threshold with no pill fill", () => {
    const span = renderValue(
      <ResourceValue value={50} resource="concerto" threshold={100} />,
    )
    expect(span.textContent).toBe("50.0")
    expect(span.style.backgroundColor).toBe("")
    expect(span.className).not.toContain("font-bold")
  })

  it("fills a concerto pill at or over 100, without bold weight", () => {
    const span = renderValue(
      <ResourceValue value={100} resource="concerto" threshold={100} />,
    )
    expect(span.style.backgroundColor).toBe("var(--ui-concerto)")
    expect(span.style.color).toBe("var(--darkest)")
    expect(span.className).not.toContain("font-bold")
  })
})
