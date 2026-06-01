import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  DamageEntry,
  EnrichedCharacter,
  SkillType,
} from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"
import type { HitEvent, SimulationLogEntry } from "#/types/simulation-log"

import { runSimulation } from "./simulation"

/**
 * Authored-path HitContext threading (ADR-0029, issue #289).
 *
 * The authored walk (`resolveTrailingBundle`) builds a HitContext from the
 * resolved stage + DamageEntry (`stageId`/`skillCategory`/`skillType`/`element`)
 * and threads it through `resolveHit`. A `stageId`-scoped `appliesToHits` bonus
 * therefore folds into a matching authored hit's own `allDmgBonus`, and a
 * non-matching hit-scoped buff drops out of the hit's `activeBuffs` list —
 * preserving "a buff listed on a hit contributed to that hit."
 */

const dmgHit = (
  value: number,
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
})

const stageOf = (kebab: string) =>
  `char.${kebab}.basic-attack.normal-attack._::basic-attack`

/** Per-hit stageId carried by the authored hit's HitContext (hit index N → `.N`). */
const hitStageId = (kebab: string, hitIndex: number) =>
  `${stageOf(kebab)}.${hitIndex + 1}`

function makeChar(
  id: number,
  name: string,
  buffs: BuffDef[] = [],
): EnrichedCharacter {
  return {
    id,
    name,
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs,
    skills: [
      {
        id: id * 10,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 60,
            damage: [dmgHit(1.5)],
          },
        ],
        damage: [],
      },
    ],
  }
}

/** A self stat buff that scopes its `allDmgBonus` to a single authored hit's stageId. */
const stageScopedBonus = (stageId: string): BuffDef => ({
  id: "gold.stage-scoped-bonus",
  name: "Stage Scoped Bonus",
  trigger: { event: "skillCast", characterId: 1, actor: "self" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  appliesToHits: { stageId },
  effects: [
    {
      kind: "stat",
      path: { stat: "allDmgBonus" },
      value: { kind: "const", v: 0.2 },
    },
  ],
})

const tlEntry = (
  characterId: number,
  stageId: string,
  id: string,
): TimelineEntry => ({ id, characterId, stageId })

let testCharacters: EnrichedCharacter[] = []
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))
afterEach(() => {
  testCharacters = []
})

const loadout: SlotLoadout = {
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
const loadouts: SlotLoadout[] = [loadout, loadout, loadout]

const authoredHit = (log: SimulationLogEntry[]): HitEvent | undefined =>
  log.find((e): e is HitEvent => e.kind === "hit" && e.sourceEntryId === "e1")

describe("authored-path HitContext — stageId-scoped appliesToHits (#289)", () => {
  it("folds a matching stageId bonus into the authored hit's allDmgBonus and lists it", () => {
    const matching = hitStageId("gold-a", 0)
    testCharacters = [makeChar(1, "Gold A", [stageScopedBonus(matching)])]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("gold-a"), "e1")],
      slots,
      loadouts,
    )
    const hit = authoredHit(log)
    expect(hit?.statsSnapshot.allDmgBonus).toBeCloseTo(0.2)
    expect(hit?.activeBuffs.map((b) => b.id)).toContain(
      "gold.stage-scoped-bonus",
    )
  })

  it("excludes a non-matching stageId bonus from both the snapshot and the list", () => {
    const nonMatching = hitStageId("gold-a", 1) // `.2` — the hit is `.1`
    testCharacters = [makeChar(1, "Gold A", [stageScopedBonus(nonMatching)])]
    const slots: Slots = [1, null, null]
    const log = runSimulation(
      [tlEntry(1, stageOf("gold-a"), "e1")],
      slots,
      loadouts,
    )
    const hit = authoredHit(log)
    expect(hit?.statsSnapshot.allDmgBonus).toBeCloseTo(0)
    expect(hit?.activeBuffs.map((b) => b.id)).not.toContain(
      "gold.stage-scoped-bonus",
    )
  })
})
