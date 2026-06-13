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

  it("renders validator findings with raw stage IDs", () => {
    expect(renderMessage({ kind: "introNeedsOutro" })).toBe(
      "Intro Skill must immediately follow an Outro Skill",
    )
    expect(renderMessage({ kind: "characterNotInTeam" })).toBe(
      "Character is not in the team",
    )
    expect(renderMessage({ kind: "unknownCharacter" })).toBe(
      "Unknown character",
    )
    expect(renderMessage({ kind: "stageNotFound", stageId: "a::b" })).toBe(
      'Stage "a::b" not found',
    )
    expect(
      renderMessage({
        kind: "missingChainPrereq",
        stageId: "a::b",
        requiredStageId: "a::pre",
      }),
    ).toBe('Stage "a::b" requires "a::pre" to immediately precede it')
    expect(
      renderMessage({
        kind: "missingWindowedPrereq",
        stageId: "a::b",
        requiredStageId: "a::pre",
      }),
    ).toBe('Stage "a::b" requires a prior "a::pre" on the same character')
    expect(renderMessage({ kind: "swapForcesDifferentChar" })).toBe(
      "Swap forces the next entry to be a different character",
    )
  })
})
