import type {
  DamageEntry,
  EnrichedCharacter,
  HealTarget,
  SkillType,
} from "#/types/character"
import type { TimelineEntry } from "#/types/timeline"
import type { BuffDef } from "#/types/buff"

/**
 * Shared, dialect-neutral test fixtures for the `simulation.*.test.ts` split
 * files. Only the small, stable helpers live here; the heavyweight character /
 * echo / loadout constants stay inlined in each test for now and migrate
 * lazily if they prove to hurt.
 */

export const dmgHit = (
  value: number,
  energy = 0,
  concerto = 0,
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Fusion",
  scalingStat: "atk",
  actionFrame: 0,
  value,
  energy,
  concerto,
  toughness: 0,
  weakness: 0,
})

export const healHit = (
  value: number,
  flat = 0,
  target: HealTarget = "self",
  type: SkillType = "Basic Attack",
): DamageEntry => ({
  type,
  dmgType: "Heal",
  scalingStat: "ATK",
  actionFrame: 0,
  flat,
  value,
  energy: 0,
  concerto: 0,
  toughness: 0,
  weakness: 0,
  target,
})

export const stageOf = (kebab: string) =>
  `char.${kebab}.basic-attack.normal-attack._::basic-attack`

export const tlEntry = (
  characterId: number,
  stageId: string,
  id = `${characterId}-${stageId}`,
): TimelineEntry => ({ id, characterId, stageId })

export function makeChar(
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
