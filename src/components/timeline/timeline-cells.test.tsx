// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { TimeCell, DurationCell, PoolCell } from "./timeline-cells"

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
  it("TimeCell uses py-2 by default and py-1.5 when dense", () => {
    expect(renderCell(<TimeCell frames={60} />).className).toContain("py-2")
    expect(renderCell(<TimeCell frames={60} dense />).className).toContain(
      "py-1.5",
    )
  })

  it("TimeCell formats frames into the damage-accent cell", () => {
    const td = renderCell(<TimeCell frames={60} />)
    expect(td.className).toContain("text-ui-damage")
    expect(td.textContent).toBe("1.00s")
  })

  it("TimeCell drops right padding and omits the wait badge at gate 0", () => {
    const td = renderCell(<TimeCell frames={60} priorGate={0} />)
    expect(td.className).toContain("pr-0")
    expect(td.textContent).toBe("1.00s")
  })

  it("TimeCell renders an inline wait badge when priorGate > 0", () => {
    const td = renderCell(<TimeCell frames={102} priorGate={42} />)
    expect(td.textContent).toBe("1.70s+0.70s")
    expect(td.querySelector("span[title='wait 0.70s']")).not.toBeNull()
  })

  it("DurationCell uses py-2 by default and py-1.5 when dense", () => {
    expect(renderCell(<DurationCell frames={30} />).className).toContain("py-2")
    expect(renderCell(<DurationCell frames={30} dense />).className).toContain(
      "py-1.5",
    )
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

  it("PoolCell honors dense padding", () => {
    expect(
      renderCell(<PoolCell value={50} color="var(--ui-concerto)" dense />)
        .className,
    ).toContain("py-1.5")
  })
})
