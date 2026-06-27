// @vitest-environment node
import { describe, it, expect } from "vitest"
import { renderMessage } from "./row-messages"

const identity = (id: string) => id

describe("renderMessage", () => {
  it("renders a footing violation needing a launch", () => {
    expect(
      renderMessage({ kind: "footingViolation", isLand: false }, identity),
    ).toBe("Launch/Jump required before an aerial stage")
  })

  it("renders a footing violation needing an airborne state", () => {
    expect(
      renderMessage({ kind: "footingViolation", isLand: true }, identity),
    ).toBe("Airborne state required before a landing stage")
  })

  it("renders a chain prerequisite with quoted resolved labels", () => {
    const resolve = (id: string) =>
      id === "stage-2" ? "Frigid Light · Stage 2" : "Frigid Light · Stage 1"
    expect(
      renderMessage(
        {
          kind: "missingChainPrereq",
          stageId: "stage-2",
          requiredStageId: "stage-1",
        },
        resolve,
      ),
    ).toBe(
      '"Frigid Light · Stage 2" must immediately follow "Frigid Light · Stage 1"',
    )
  })

  it("renders a windowed prerequisite with quoted resolved labels", () => {
    const resolve = (id: string) =>
      id === "welcome"
        ? "Flaming Woolies · Energetic Welcome"
        : "Flaming Woolies"
    expect(
      renderMessage(
        {
          kind: "missingWindowedPrereq",
          stageId: "welcome",
          requiredStageId: "base",
        },
        resolve,
      ),
    ).toBe(
      '"Flaming Woolies · Energetic Welcome" requires an earlier "Flaming Woolies" on this character',
    )
  })

  it("renders an insufficient-energy diagnostic with only the cost", () => {
    expect(
      renderMessage(
        { kind: "insufficientEnergy", actor: "char-0", energy: 40, cost: 125 },
        identity,
      ),
    ).toBe("Liberation requires 125 energy")
  })

  it("renders an availability-gate insufficient-concerto diagnostic with the requirement", () => {
    expect(
      renderMessage(
        {
          kind: "insufficientConcerto",
          actor: "char-0",
          concerto: 30,
          required: 100,
        },
        identity,
      ),
    ).toBe("Requires 100 Concerto Energy")
  })

  it("renders an Outro insufficient-concerto diagnostic with only the cost", () => {
    expect(
      renderMessage(
        {
          kind: "insufficientOutroConcerto",
          actor: "char-0",
          concerto: 30,
          cost: 100,
        },
        identity,
      ),
    ).toBe("Outro requires 100 concerto")
  })

  it("renders the swap-forces-different-character warning", () => {
    expect(renderMessage({ kind: "swapForcesDifferentChar" }, identity)).toBe(
      "Swap forces the next entry to be a different character",
    )
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
