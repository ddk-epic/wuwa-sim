// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { TimeCell, WaitCell, PoolCell } from "./timeline-cells"

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

  it("WaitCell is empty at gate 0", () => {
    const td = renderCell(<WaitCell priorGate={0} />)
    expect(td.textContent).toBe("")
    expect(td.querySelector("span[title^='wait']")).toBeNull()
  })

  it("WaitCell renders the wait badge when priorGate > 0", () => {
    const td = renderCell(<WaitCell priorGate={42} />)
    expect(td.textContent).toBe("+0.70s")
    expect(td.querySelector("span[title='wait 0.70s']")).not.toBeNull()
  })

  it("PoolCell adds opacity-40 only when stale", () => {
    expect(
      renderCell(<PoolCell value={50} color="var(--ui-concerto)" />).className,
    ).not.toContain("opacity-40")
    expect(
      renderCell(<PoolCell value={50} color="var(--ui-concerto)" stale />)
        .className,
    ).toContain("opacity-40")
  })
})
