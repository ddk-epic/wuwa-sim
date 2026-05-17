import type {
  TimelineEntry,
  TimelineGroup,
  TimelineNode,
} from "#/types/timeline"
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

export function migrateNodes(raw: unknown[]): TimelineNode[] {
  return raw.map((r) => {
    const item = r as { kind?: string }
    if (item.kind === "group") {
      const g = r as Partial<TimelineGroup>
      return {
        kind: "group" as const,
        id: typeof g.id === "string" ? g.id : crypto.randomUUID(),
        label: typeof g.label === "string" ? g.label : "",
        locked: typeof g.locked === "boolean" ? g.locked : true,
        entries: Array.isArray(g.entries) ? migrateEntries(g.entries) : [],
      }
    }
    // Legacy TimelineEntry (no kind) or already a {kind:"entry"} node
    const migrated = migrateEntries([r])[0]
    return { kind: "entry" as const, ...migrated }
  })
}
