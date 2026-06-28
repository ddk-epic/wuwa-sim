// @vitest-environment node
import { describe, it, expect } from "vitest"
import { renderMessage } from "./row-messages"

const identity = (id: string) => id

describe("renderMessage", () => {
  it("renders a footing violation needing an airborne state", () => {
    expect(
      renderMessage({ kind: "footingViolation", isLand: true }, identity),
    ).toBe("Airborne state required before a landing stage")
  })

  it("renders footingFall as the consequence applied, not a violated precondition", () => {
    expect(renderMessage({ kind: "footingFall" }, identity)).toBe(
      "Fall padding inserted before a grounded entry",
    )
  })

  it("renders footingForced naming the forced direction for each footing", () => {
    expect(
      renderMessage({ kind: "footingForced", footing: "air" }, identity),
    ).toBe("Air-only mode forces an aerial entry")
    expect(
      renderMessage({ kind: "footingForced", footing: "ground" }, identity),
    ).toBe("Ground-only mode forces a grounded entry")
  })

  it("renders stageNotFound without leaking the stage id", () => {
    const message = renderMessage(
      {
        kind: "stageNotFound",
        stageId: "char.foo.bar.baz.qux::resonance-skill",
      },
      identity,
    )
    expect(message).toBe("This skill is no longer available for this character")
    expect(message).not.toContain("char.foo")
  })
})
