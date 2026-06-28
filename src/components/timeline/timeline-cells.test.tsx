// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { TimeCell, WaitCell, ForteCell, ResourceCell } from "./timeline-cells"

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

  it("ForteCell shows the gauge to one decimal for a forte character", () => {
    expect(
      renderCell(<ForteCell value={42} forteCap={100} />).textContent,
    ).toBe("42.0")
  })

  it("ForteCell is empty without log data or a forte gauge", () => {
    expect(
      renderCell(<ForteCell value={null} forteCap={100} />).textContent,
    ).toBe("")
    expect(renderCell(<ForteCell value={42} forteCap={0} />).textContent).toBe(
      "",
    )
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
