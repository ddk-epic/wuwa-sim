// @vitest-environment node
import { describe, it, expect } from "vitest"
import { renderMessage } from "./row-messages"

describe("renderMessage", () => {
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
          requiredStageIds: ["stage-1-id"],
        },
        resolveName,
      ),
    ).toBe(
      '"Normal Attack · Stage 2" must immediately follow "Normal Attack · Stage 1"',
    )
  })

  it("renders missingChainPrereq any-of list joined with or", () => {
    expect(
      renderMessage(
        {
          kind: "missingChainPrereq",
          stageId: "stage-2-id",
          requiredStageIds: ["stage-1-id", "stage-2-id"],
        },
        resolveName,
      ),
    ).toBe(
      '"Normal Attack · Stage 2" must immediately follow "Normal Attack · Stage 1" or "Normal Attack · Stage 2"',
    )
  })
})
