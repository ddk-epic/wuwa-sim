// @vitest-environment node
import { describe, it, expect } from "vitest"
import { resolveHealTargets } from "./heal-targets"

/**
 * The single home for the `HealTarget → characterId[]` mapping, shared by the
 * authored-heal path (`simulation.ts`) and the synthetic-heal host
 * (`buff-engine.ts`). Each caller supplies its own resolved team list; the
 * mapping itself lives here.
 */
describe("resolveHealTargets", () => {
  const SOURCE = 1
  const TEAM = [1, 2, 3]

  it("resolves self/source/currentOnField to the source", () => {
    expect(resolveHealTargets("self", SOURCE, TEAM)).toEqual([SOURCE])
    expect(resolveHealTargets("source", SOURCE, TEAM)).toEqual([SOURCE])
    // currentOnField is a stub resolving to the source, not the actual on-field
    // character — preserved behavior, fixed in one place if ever changed.
    expect(resolveHealTargets("currentOnField", SOURCE, TEAM)).toEqual([SOURCE])
  })

  it("resolves team to the supplied team list", () => {
    expect(resolveHealTargets("team", SOURCE, TEAM)).toEqual(TEAM)
  })
})
