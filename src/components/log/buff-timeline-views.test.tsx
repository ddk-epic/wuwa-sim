// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
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
  it("header reads `action · <FULL CATEGORY>` when an action is live", () => {
    const { container } = render(
      <BuffTimelineSidebar model={model()} hover={{ t: 0.5 }} />,
    )
    expect(container.textContent).toContain("action · Resonance Skill")
  })

  it("header falls back to plain `action` over an idle gap", () => {
    const { container } = render(
      <BuffTimelineSidebar model={model()} hover={{ t: 5 }} />,
    )
    expect(container.textContent).toContain("action")
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
