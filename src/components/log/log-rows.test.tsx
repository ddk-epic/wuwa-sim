// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import type {
  ActionEvent,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import { ActionEventRow } from "./ActionEventRow"
import { HitEventRow } from "./HitEventRow"
import { SustainEventRow } from "./SustainEventRow"
import { COL_COUNT } from "./log-cells"

const base = {
  characterId: 1,
  skillType: "Basic Attack" as const,
  skillName: "Test Skill",
  frame: 60,
  cumulativeEnergy: 10,
  cumulativeConcerto: 5,
}

const action: ActionEvent = {
  ...base,
  kind: "action",
  skillCategory: "Basic Attack",
}

const hit: HitEvent = {
  ...base,
  kind: "hit",
  damage: 1234,
  element: "Glacio",
  dmgType: "basic",
  multiplier: 1,
  statsSnapshot: emptyStatTable(),
  activeBuffs: [],
  passiveBuffs: [],
}

const sustain: SustainEvent = {
  ...base,
  kind: "sustain",
  sub: "heal",
  amount: 500,
  targets: [1],
  multiplier: 1,
  statsSnapshot: emptyStatTable(),
  activeBuffs: [],
  passiveBuffs: [],
}

function cellCount(container: HTMLElement): number {
  // The first <tr> is the row body (HitEventRow adds a detail <tr> only when open).
  const firstRow = container.querySelector("tr")!
  return firstRow.querySelectorAll("td").length
}

function renderRow(node: React.ReactElement): HTMLElement {
  const { container } = render(
    <table>
      <tbody>{node}</tbody>
    </table>,
  )
  return container
}

describe("log rows column count", () => {
  it("ActionEventRow renders COL_COUNT cells", () => {
    expect(cellCount(renderRow(<ActionEventRow ev={action} index={0} />))).toBe(
      COL_COUNT,
    )
  })

  it("SustainEventRow renders COL_COUNT cells", () => {
    expect(
      cellCount(renderRow(<SustainEventRow ev={sustain} index={0} />)),
    ).toBe(COL_COUNT)
  })

  it("HitEventRow renders COL_COUNT cells (collapsed)", () => {
    expect(
      cellCount(
        renderRow(
          <HitEventRow ev={hit} index={0} isOpen={false} onToggle={() => {}} />,
        ),
      ),
    ).toBe(COL_COUNT)
  })

  it("HitEventRow index cell shows a caret", () => {
    const container = renderRow(
      <HitEventRow ev={hit} index={0} isOpen={false} onToggle={() => {}} />,
    )
    expect(container.textContent).toContain("▸")
  })
})

describe("prior-gate wait badge on action rows", () => {
  it("ActionEventRow renders an inline wait badge from delayBreakdown.priorGate", () => {
    const container = renderRow(
      <ActionEventRow
        ev={{
          ...action,
          delayBreakdown: {
            react: 0,
            floor: 0,
            pad: 0,
            fall: 0,
            swapBack: 0,
            priorGate: 42,
          },
        }}
        index={0}
      />,
    )
    expect(container.querySelector("span[title='wait 0.70s']")).not.toBeNull()
  })

  it("ActionEventRow omits the wait badge when there is no delayBreakdown", () => {
    const container = renderRow(<ActionEventRow ev={action} index={0} />)
    expect(container.querySelector("span[title^='wait']")).toBeNull()
  })

  it("HitEventRow does not feed FrameCell a priorGate", () => {
    const container = renderRow(
      <HitEventRow ev={hit} index={0} isOpen={false} onToggle={() => {}} />,
    )
    expect(container.querySelector("span[title^='wait']")).toBeNull()
  })
})
