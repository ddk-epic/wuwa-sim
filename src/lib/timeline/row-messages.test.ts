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

  // A Map-backed resolver distinguishes a resolved name from a leaked raw id;
  // identity could not.
  const resolveName = (id: string): string =>
    ({
      "stage-2-id": "Normal Attack · Stage 2",
      "stage-1-id": "Normal Attack · Stage 1",
    })[id] ?? id

  it("renders missingChainPrereq with both stage ids resolved to names", () => {
    expect(
      renderMessage(
        {
          kind: "missingChainPrereq",
          stageId: "stage-2-id",
          requiredStageId: "stage-1-id",
        },
        resolveName,
      ),
    ).toBe(
      '"Normal Attack · Stage 2" must immediately follow "Normal Attack · Stage 1"',
    )
  })

  it("renders missingWindowedPrereq with both stage ids resolved to names", () => {
    expect(
      renderMessage(
        {
          kind: "missingWindowedPrereq",
          stageId: "stage-2-id",
          requiredStageId: "stage-1-id",
        },
        resolveName,
      ),
    ).toBe(
      '"Normal Attack · Stage 2" requires an earlier "Normal Attack · Stage 1" on this character',
    )
  })

  it("renders stageRequiresSequence with the stage id resolved to a name", () => {
    expect(
      renderMessage(
        {
          kind: "stageRequiresSequence",
          stageId: "stage-2-id",
          requiredSequence: 2,
        },
        resolveName,
      ),
    ).toBe('"Normal Attack · Stage 2" requires Sequence 2')
  })
})
