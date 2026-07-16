// @vitest-environment node
import { describe, expect, it } from "vitest"
import { GLOBAL_TARGET_ID } from "#/types/buff"
import { characterVisual, TEAM_HEX } from "./character-visual"

describe("characterVisual", () => {
  it("global sentinel id → Team identity with blue accent and no portrait", () => {
    const v = characterVisual(GLOBAL_TARGET_ID)
    expect(v.name).toBe("Team")
    expect(v.element).toBe("SHARED")
    expect(v.hex).toBe(TEAM_HEX)
    expect(v.portraitSrc).toBe("")
    expect(v.isTeam).toBe(true)
  })
})
