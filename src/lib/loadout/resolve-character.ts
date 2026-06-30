import type { BuffDef, StatPath } from "#/types/buff"
import type { EnrichedCharacter } from "#/types/character"
import type { StatTable } from "#/types/stat-table"
import { ELEMENTS } from "#/data/elements"
import { compileCharacter } from "#/lib/compile-character"

// Character intrinsic crit floor before any echo/weapon/buff contribution.
const CHARACTER_BASE_CRIT_RATE = 0.05
const CHARACTER_BASE_CRIT_DMG = 1.5

export function resolveCharacterStats(
  stats: StatTable,
  character: EnrichedCharacter,
): void {
  stats.atkBase += character.stats.max.atk
  stats.hpBase += character.stats.max.hp
  stats.defBase += character.stats.max.def
  stats.critRate += CHARACTER_BASE_CRIT_RATE
  stats.critDmg += CHARACTER_BASE_CRIT_DMG
}

const FLAT_VALUE_BY_NAME: Record<
  string,
  { path: StatPath; v: number } | undefined
> = {
  ATK: { path: { stat: "atkPct" }, v: 0.12 },
  HP: { path: { stat: "hpPct" }, v: 0.12 },
  DEF: { path: { stat: "defPct" }, v: 0.12 },
  "Crit. Rate": { path: { stat: "critRate" }, v: 0.08 },
  "Crit. DMG": { path: { stat: "critDmg" }, v: 0.16 },
}

function compileSkillTreeNode(
  nodeName: string,
  ctx: { characterId: number; characterElement: string },
): BuffDef | null {
  const elementMatch = ELEMENTS.find((e) => nodeName === `${e} DMG Bonus`)
  if (elementMatch) {
    return {
      id: `skill-tree.${ctx.characterId}.${nodeName}`,
      name: nodeName,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: { stat: "elementBonus", key: elementMatch },
          value: { kind: "const", v: 0.12 },
        },
      ],
    }
  }

  const flat = FLAT_VALUE_BY_NAME[nodeName]
  if (flat) {
    return {
      id: `skill-tree.${ctx.characterId}.${nodeName}`,
      name: nodeName,
      trigger: { event: "simStart" },
      target: { kind: "self" },
      duration: { kind: "permanent" },
      effects: [
        {
          kind: "stat",
          path: flat.path,
          value: { kind: "const", v: flat.v },
        },
      ],
    }
  }

  return null
}

export function resolveCharacterBuffs(
  character: EnrichedCharacter,
  sequence: number,
): BuffDef[] {
  const buffs: BuffDef[] = []
  for (const def of compileCharacter(character).buffs) {
    if (
      (def.requiresSequence ?? 0) <= sequence &&
      (def.maxSequence === undefined || sequence <= def.maxSequence)
    )
      buffs.push(def)
  }
  for (const nodeName of character.skillTreeBonuses) {
    const def = compileSkillTreeNode(nodeName, {
      characterId: character.id,
      characterElement: character.element,
    })
    if (def) buffs.push(def)
  }
  return buffs
}
