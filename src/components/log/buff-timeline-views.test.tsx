// @vitest-environment jsdom
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import { BuffTimelineSidebar } from "./BuffTimelineSidebar"
import { BuffTimelinePlot } from "./BuffTimelinePlot"
import type {
  BuffTimelineModel,
  ActionBlock,
} from "./build-buff-timeline-model"

// A liberation whose damage collapsed to a Basic Attack damage type — the two
// axes diverge so we can tell category from skillType in the output.
const libBlock: ActionBlock = {
  charId: 1,
  skillName: "Burst",
  skillCategory: "Resonance Skill",
  skillType: "Basic Attack",
  start: 0,
  end: 1,
  laneSpan: 1,
}

const model = (over: Partial<BuffTimelineModel> = {}): BuffTimelineModel => ({
  charIds: [1],
  actionBlocks: [libBlock],
  buffs: [],
  passivesByChar: new Map(),
  axisMax: 10,
  restStart: 1,
  ...over,
})

describe("BuffTimelineSidebar — action header", () => {
  it("header shows the FULL category when an action is live", () => {
    const { container } = render(
      <BuffTimelineSidebar model={model()} hover={{ t: 0.5 }} />,
    )
    expect(container.textContent).toContain("Resonance Skill")
    expect(container.textContent).toContain("Burst")
  })

  it("header falls back to an idle gap over a dead zone", () => {
    const { container } = render(
      <BuffTimelineSidebar model={model()} hover={{ t: 5 }} />,
    )
    expect(container.textContent).not.toContain("Resonance Skill")
    expect(container.textContent).toContain("idle / gap")
  })

  it("still shows the damage type (skillType) on the detail line", () => {
    const { container } = render(
      <BuffTimelineSidebar model={model()} hover={{ t: 0.5 }} />,
    )
    // skillType "Basic Attack" → "BASIC"; not the category "SKILL"
    expect(container.textContent).toContain("BASIC")
  })
})

// PX_PER_SEC is 104; with a zero-origin jsdom rect, clientX 200 → t ≈ 0.115s
// (inside the [0,1] action block) and clientX 400 → t ≈ 2.04s (past restStart).
function FreezeHarness({ model: m }: { model: BuffTimelineModel }) {
  const [hover, setHover] = useState<{ t: number } | null>(null)
  return (
    <>
      <BuffTimelinePlot model={m} hover={hover} setHover={setHover} />
      <BuffTimelineSidebar model={m} hover={hover} />
    </>
  )
}

describe("BuffTimelinePlot — frozen hover", () => {
  it("holds the last valid time after the cursor leaves the plot", () => {
    const { container } = render(<FreezeHarness model={model()} />)
    const plot = container.querySelector(".cursor-crosshair")!

    fireEvent.mouseMove(plot, { clientX: 200 })
    expect(container.textContent).toContain("Resonance Skill")

    fireEvent.mouseLeave(plot)
    expect(container.textContent).toContain("Resonance Skill")
    expect(container.textContent).not.toContain("Hover over the timeline")
  })

  it("holds the last valid time when grazing the past-end zone", () => {
    const { container } = render(<FreezeHarness model={model()} />)
    const plot = container.querySelector(".cursor-crosshair")!

    fireEvent.mouseMove(plot, { clientX: 200 })
    expect(container.textContent).toContain("Resonance Skill")

    fireEvent.mouseMove(plot, { clientX: 400 })
    expect(container.textContent).toContain("Resonance Skill")
  })
})

describe("BuffTimelinePlot — strip pill", () => {
  it("pill shows the shortened category and tooltip shows the category", () => {
    const { container } = render(
      <BuffTimelinePlot model={model()} hover={null} setHover={() => {}} />,
    )
    // category "Resonance Skill" → "SKILL"; damage type would be "BASIC"
    const pill = container.querySelector('[title="Burst · Resonance Skill"]')
    expect(pill).not.toBeNull()
    expect(pill?.textContent).toContain("SKILL")
  })
})
