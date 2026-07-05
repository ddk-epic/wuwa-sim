// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter, SkillCategory } from "#/types/character"
import type { HitContext } from "#/types/buff"
import type { SlotLoadout } from "#/types/loadout"
import { BuffEngine } from "#/lib/engine/buff-engine"
import { onEventResolved } from "#/lib/engine/buff-engine.test-utils"
import { cartethyia } from "./cartethyia"

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

function makeEngine(sequence = 0) {
  testCharacters = [cartethyia]
  const engine = new BuffEngine()
  const loadout = { ...emptyLoadout, sequence }
  engine.bootstrap({
    slots: [1409, null, null],
    loadouts: [loadout, emptyLoadout, emptyLoadout],
  })
  return engine
}

const STAGE = {
  plunge:
    "char.cartethyia.basic-attack.sword-to-carve-my-forms.mid-air-attack::basic-attack",
  basicStage4:
    "char.cartethyia.basic-attack.sword-to-carve-my-forms.stage-4::basic-attack",
  heavy:
    "char.cartethyia.basic-attack.sword-to-carve-my-forms.heavy-attack::basic-attack",
  resonanceSkill:
    "char.cartethyia.resonance-skill.sword-to-bear-their-names.cast::basic-attack",
  liberationCast:
    "char.cartethyia.resonance-liberation.a-knight-s-heartfelt-prayers.cast::resonance-liberation",
  blade:
    "char.cartethyia.resonance-liberation.a-knight-s-heartfelt-prayers.blade-of-howling-squall::resonance-liberation",
}

function cast(
  engine: BuffEngine,
  stageId: string,
  skillCategory: SkillCategory,
  frame: number,
) {
  return onEventResolved(engine, {
    kind: "skillCast",
    characterId: 1409,
    skillCategory,
    stageId,
    frame,
  })
}

describe("Cartethyia — Sword Shadows & recall", () => {
  it("Resonance Skill summons a Sword of Virtue's Shadow", () => {
    const engine = makeEngine()
    cast(engine, STAGE.resonanceSkill, "Resonance Skill", 0)
    expect(engine.activeBuffIds(1409)).toContain(
      "char.cartethyia.sword-of-virtue",
    )
  })

  it("plunge with no shadows emits the single base plunge hit", () => {
    const engine = makeEngine()
    const { syntheticEvents } = cast(engine, STAGE.plunge, "Basic Attack", 0)
    expect(syntheticEvents).toHaveLength(1)
    const hit = syntheticEvents[0]
    expect(hit.kind === "hit" && hit.multiplier).toBeCloseTo(0.0565)
  })

  it("plunge recalling two shadows emits the 3-hit profile, consumes the shadows, grants both powers", () => {
    const engine = makeEngine()
    cast(engine, STAGE.resonanceSkill, "Resonance Skill", 0) // Virtue
    cast(engine, STAGE.basicStage4, "Basic Attack", 30) // Divinity
    expect(engine.activeBuffIds(1409)).toEqual(
      expect.arrayContaining([
        "char.cartethyia.sword-of-virtue",
        "char.cartethyia.sword-of-divinity",
      ]),
    )

    const { syntheticEvents } = cast(engine, STAGE.plunge, "Basic Attack", 60)
    expect(syntheticEvents).toHaveLength(3)
    const hit = syntheticEvents[0]
    expect(hit.kind === "hit" && hit.multiplier).toBeCloseTo(0.033)

    const after = engine.activeBuffIds(1409)
    expect(after).not.toContain("char.cartethyia.sword-of-virtue")
    expect(after).not.toContain("char.cartethyia.sword-of-divinity")
    expect(after).toEqual(
      expect.arrayContaining([
        "char.cartethyia.heart-of-virtue",
        "char.cartethyia.mandate-of-divinity",
      ]),
    )
  })

  it("Manifest end clears Manifest and the held powers", () => {
    const engine = makeEngine()
    cast(engine, STAGE.resonanceSkill, "Resonance Skill", 0)
    cast(engine, STAGE.plunge, "Basic Attack", 30) // recall → Heart of Virtue
    cast(engine, STAGE.liberationCast, "Resonance Liberation", 60)
    expect(engine.activeBuffIds(1409)).toEqual(
      expect.arrayContaining([
        "char.cartethyia.manifest",
        "char.cartethyia.heart-of-virtue",
      ]),
    )

    cast(engine, STAGE.blade, "Resonance Liberation", 90)
    const after = engine.activeBuffIds(1409)
    expect(after).not.toContain("char.cartethyia.manifest")
    expect(after).not.toContain("char.cartethyia.fleurdelys-form")
    expect(after).not.toContain("char.cartethyia.heart-of-virtue")
    expect(after).not.toContain("char.cartethyia.mandate-of-divinity")
    expect(after).not.toContain("char.cartethyia.power-of-discord")
  })
})

describe("Cartethyia — amps", () => {
  it("Wind's Indelible Imprint adds vul only while the target has Aero Erosion", () => {
    const engine = makeEngine()
    expect(engine.resolveStats(1409).vul).toBeCloseTo(0)

    engine.onEvent({
      kind: "hitLanded",
      characterId: 1409,
      skillCategory: "Resonance Skill",
      dmgType: "Aero",
      stageId: STAGE.resonanceSkill,
      hitIndex: 4,
      frame: 0,
      energy: 0,
      concerto: 0,
    })
    expect(engine.getTarget().stacksOf("Aero Erosion")).toBe(2)
    expect(engine.resolveStats(1409).vul).toBeCloseTo(0.3)
  })

  it("S2 raises the Basic Attack DMG Multiplier via appliesToHits but spares unlisted stages", () => {
    const engine = makeEngine(2)
    const basicCtx: HitContext = {
      stageId:
        "char.cartethyia.basic-attack.sword-to-carve-my-forms.stage-1::basic-attack",
      skillType: "Basic Attack",
      skillCategory: "Basic Attack",
      element: "Aero",
    }
    expect(engine.resolveStats(1409, basicCtx).bonusMultiplier).toBeCloseTo(0.5)

    const rsCtx: HitContext = {
      stageId: STAGE.resonanceSkill,
      skillType: "Basic Attack",
      skillCategory: "Resonance Skill",
      element: "Aero",
    }
    expect(engine.resolveStats(1409, rsCtx).bonusMultiplier).toBeCloseTo(0)
  })
})
