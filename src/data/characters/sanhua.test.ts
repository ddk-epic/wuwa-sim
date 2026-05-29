import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { sanhua } from "./sanhua"

let testCharacters: EnrichedCharacter[] = []

vi.mock("../../lib/loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getWeaponById: () => null,
  getEchoById: () => null,
  getEchoSetById: () => null,
}))

afterEach(() => {
  testCharacters = []
})

const emptyLoadout: SlotLoadout = {
  weaponId: null,
  weaponRank: 1,
  echoId: null,
  echoSetSlot1Id: null,
  echoSetSlot2Id: null,
  sequence: 0,
  echoBuild: "4-3-3-1-1",
  cost4Mains: ["cd"],
  cost3Mains: ["elemDmg", "elemDmg"],
}

function makeEngine() {
  testCharacters = [sanhua]
  const engine = new BuffEngine()
  engine.bootstrap({
    slots: [1102, null, null],
    loadouts: [emptyLoadout, emptyLoadout, emptyLoadout],
  })
  return engine
}

describe("Sanhua — Avalanche (Forte Circuit Ice Burst +20%)", () => {
  it("applies Avalanche flag (no stat effect) on Frigid Light Stage 5 cast", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    expect(engine.activeBuffIds(1102)).toContain(
      "char.sanhua.passive.avalanche",
    )
    const stats = engine.resolveStats(1102)
    expect(stats.skillTypeBonus["Resonance Skill"]).toBe(0)
    expect(stats.skillTypeBonus["Basic Attack"]).toBe(0)
  })

  it("fires Ice Thorn bonus coordHit when Avalanche is active", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    const { syntheticEvents } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      synthetic: true,
      sourceBuffId: "char.sanhua.ice-thorn-burst",
      frame: 30,
    })
    const bonus = syntheticEvents.find(
      (e) => e.sourceBuffId === "char.sanhua.passive.avalanche.bonus.thorn",
    )
    expect(bonus).toBeDefined()
    expect(bonus?.kind).toBe("hit")
  })

  it("does not fire bonus when Avalanche flag is absent", () => {
    const engine = makeEngine()
    const { syntheticEvents } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      synthetic: true,
      sourceBuffId: "char.sanhua.ice-thorn-burst",
      frame: 0,
    })
    const bonus = syntheticEvents.find((e) =>
      e.sourceBuffId?.startsWith("char.sanhua.passive.avalanche.bonus"),
    )
    expect(bonus).toBeUndefined()
  })

  it("fires Ice Prism and Ice Glacier bonuses with their own multipliers", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    const prismDispatch = engine.onEvent({
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      synthetic: true,
      sourceBuffId: "char.sanhua.ice-prism-burst",
      frame: 30,
    })
    const prismBonus = prismDispatch.syntheticEvents.find(
      (e) => e.sourceBuffId === "char.sanhua.passive.avalanche.bonus.prism",
    )
    expect(prismBonus?.kind === "hit" && prismBonus.multiplier).toBeCloseTo(
      0.15906,
    )

    const glacierDispatch = engine.onEvent({
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      synthetic: true,
      sourceBuffId: "char.sanhua.ice-glacier-burst",
      frame: 31,
    })
    const glacierBonus = glacierDispatch.syntheticEvents.find(
      (e) => e.sourceBuffId === "char.sanhua.passive.avalanche.bonus.glacier",
    )
    expect(glacierBonus?.kind === "hit" && glacierBonus.multiplier).toBeCloseTo(
      0.27834,
    )
  })

  it("does not fire bonus from non-burst Resonance Skill hits while Avalanche is active", () => {
    const engine = makeEngine()
    engine.onEvent({
      kind: "skillCast",
      characterId: 1102,
      skillCategory: "Basic Attack",
      stageId: "char.sanhua.basic-attack.frigid-light.stage-5::basic-attack",
      frame: 0,
    })
    const { syntheticEvents } = engine.onEvent({
      kind: "hitLanded",
      characterId: 1102,
      skillCategory: "Resonance Skill",
      dmgType: "Damage",
      frame: 30,
    })
    const bonus = syntheticEvents.find((e) =>
      e.sourceBuffId?.startsWith("char.sanhua.passive.avalanche.bonus"),
    )
    expect(bonus).toBeUndefined()
  })
})
