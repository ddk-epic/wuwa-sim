import type { TimelineEntry } from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import { getCharacterById } from "./catalog"
import { makeStageId, stageLabel } from "./stage"

type LegacyEntry = {
  id?: string
  characterId?: number
  skillType?: string
  skillName?: string
  stageId?: string
  variantKind?: VariantKind
}

export function migrateEntries(raw: unknown[]): TimelineEntry[] {
  return raw.map((r) => {
    const legacy = r as LegacyEntry
    const id = typeof legacy.id === "string" ? legacy.id : crypto.randomUUID()
    const characterId =
      typeof legacy.characterId === "number" ? legacy.characterId : 0
    const variantKind = legacy.variantKind

    if (typeof legacy.stageId === "string") {
      return { id, characterId, stageId: legacy.stageId, variantKind }
    }

    const { skillType, skillName } = legacy
    if (!skillType || !skillName) {
      return { id, characterId, stageId: "", variantKind }
    }

    // Echo skills can't be migrated without loadout context — mark invalid
    if (skillType === "Echo Skill") {
      return { id, characterId, stageId: "", variantKind }
    }

    const character = getCharacterById(characterId)
    if (character) {
      for (const skill of character.skills) {
        if (skill.type !== skillType) continue
        const stage = skill.stages.find(
          (s) => stageLabel(skill.name, s.newName) === skillName,
        )
        if (stage) {
          return {
            id,
            characterId,
            stageId: makeStageId(skill.name, stage.newName),
            variantKind,
          }
        }
      }
    }

    return { id, characterId, stageId: "", variantKind }
  })
}
