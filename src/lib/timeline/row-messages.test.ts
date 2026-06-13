import { describe, it, expect } from "vitest"
import { renderMessage } from "./row-messages"

describe("renderMessage", () => {
  it("renders a footing violation needing a launch", () => {
    expect(renderMessage({ kind: "footingViolation", isLand: false })).toBe(
      "Launch/Jump required before an aerial stage",
    )
  })

  it("renders a footing violation with nothing to land from", () => {
    expect(renderMessage({ kind: "footingViolation", isLand: true })).toBe(
      "Nothing to land from — not currently airborne",
    )
  })

  it("floors the energy reading in an insufficient-energy message", () => {
    expect(
      renderMessage({
        kind: "insufficientEnergy",
        actor: "Encore",
        energy: 99.6,
        cost: 125,
      }),
    ).toBe("Encore cast Liberation below cost (99 / 125 energy)")
  })

  it("floors the concerto reading in an insufficient-concerto message", () => {
    expect(
      renderMessage({
        kind: "insufficientConcerto",
        actor: "Test Character",
        concerto: 50.4,
        cost: 100,
      }),
    ).toBe("Test Character cast Outro below cost (50 / 100 concerto)")
  })
})
