// @vitest-environment node
import { describe, expect, it } from "vitest"
import { suggestedTeamName } from "./team-ops"
import { getCharacterById } from "./catalog"

describe("suggestedTeamName", () => {
  it("falls back to 'New team' when no slot is occupied", () => {
    expect(suggestedTeamName([null, null, null])).toBe("New team")
  })

  it("names after the first occupied slot", () => {
    const sanhua = getCharacterById(1102)!
    expect(suggestedTeamName([1102, null, null])).toBe(`${sanhua.name}'s Team`)
  })

  it("uses the next filled slot when slot 0 is empty", () => {
    const second = getCharacterById(1203)!
    expect(suggestedTeamName([null, 1203, null])).toBe(`${second.name}'s Team`)
  })
})
