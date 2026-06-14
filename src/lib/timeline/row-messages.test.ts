import { describe, it, expect } from "vitest"
import { renderMessage } from "./row-messages"

describe("renderMessage", () => {
  it("renders a footing violation needing a launch", () => {
    expect(renderMessage({ kind: "footingViolation", isLand: false })).toBe(
      "Launch/Jump required before an aerial stage",
    )
  })

  it("renders a footing violation needing an airborne state", () => {
    expect(renderMessage({ kind: "footingViolation", isLand: true })).toBe(
      "Airborne state required before a landing stage",
    )
  })
})
