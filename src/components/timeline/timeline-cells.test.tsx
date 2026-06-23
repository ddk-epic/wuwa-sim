// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { TimeCell, WaitCell, ResourceCell } from "./timeline-cells"

function renderCell(node: React.ReactElement): HTMLTableCellElement {
  const { container } = render(
    <table>
      <tbody>
        <tr>{node}</tr>
      </tbody>
    </table>,
  )
  return container.querySelector("td")!
}

describe("timeline-cells", () => {
  it("TimeCell formats frames into the damage-accent cell", () => {
    const td = renderCell(<TimeCell frames={60} />)
    expect(td.className).toContain("text-ui-damage")
    expect(td.textContent).toBe("1.00s")
  })

  it("WaitCell renders the wait badge when wait > 0", () => {
    const td = renderCell(<WaitCell wait={42} />)
    expect(td.textContent).toBe("+0.70s")
    expect(td.querySelector("span[title='wait 0.70s']")).not.toBeNull()
  })

  it("ResourceCell adds opacity-40 only when stale", () => {
    expect(
      renderCell(
        <ResourceCell value={50} resource="concerto" threshold={100} />,
      ).className,
    ).not.toContain("opacity-40")
    expect(
      renderCell(
        <ResourceCell value={50} resource="concerto" threshold={100} stale />,
      ).className,
    ).toContain("opacity-40")
  })
})
