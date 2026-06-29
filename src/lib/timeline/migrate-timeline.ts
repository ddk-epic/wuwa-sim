import type {
  TimelineEntry,
  TimelineGroup,
  TimelineNode,
} from "#/types/timeline"
import type { VariantKind } from "#/types/character"
import { getCompiledCharacter } from "../compile-character"

type LegacyEntry = {
  id?: string
  characterId?: number
  stageId?: string
  variantKind?: VariantKind
}

/**
 * Keep a stageId only when it still resolves. Echo ids pass through unverified
 * (resolution needs the loadout); anything else unknown — including pre-key
 * legacy formats — blanks out and the entry is remade by the user.
 */
function migrateStageId(stageId: string, characterId: number): string {
  if (stageId.startsWith("echo.") && stageId.includes("::")) return stageId
  if (getCompiledCharacter(characterId)?.stageIndex.has(stageId)) return stageId
  return ""
}

export function migrateEntries(raw: unknown[]): TimelineEntry[] {
  return raw.map((r) => {
    // Boundary: untyped legacy entry; every field is typeof-checked before use.
    const legacy = r as LegacyEntry
    const id = typeof legacy.id === "string" ? legacy.id : crypto.randomUUID()
    const characterId =
      typeof legacy.characterId === "number" ? legacy.characterId : 0
    const variantKind = legacy.variantKind
    const stageId =
      typeof legacy.stageId === "string" && legacy.stageId !== ""
        ? migrateStageId(legacy.stageId, characterId)
        : ""
    return { id, characterId, stageId, variantKind }
  })
}

export function migrateNodes(raw: unknown[]): TimelineNode[] {
  return raw.map((r): TimelineNode => {
    // Boundary: untyped legacy node; shape is probed via kind then field-checked.
    const item = r as { kind?: string }
    if (item.kind === "loopMarker") {
      const m = r as { id?: string }
      return {
        kind: "loopMarker",
        id: typeof m.id === "string" ? m.id : crypto.randomUUID(),
      }
    }
    if (item.kind === "group") {
      const g = r as Partial<TimelineGroup>
      return {
        kind: "group",
        id: typeof g.id === "string" ? g.id : crypto.randomUUID(),
        label: typeof g.label === "string" ? g.label : "",
        locked: typeof g.locked === "boolean" ? g.locked : true,
        entries: Array.isArray(g.entries) ? migrateEntries(g.entries) : [],
      }
    }
    // Legacy TimelineEntry (no kind) or already a {kind:"entry"} node
    const migrated = migrateEntries([r])[0]
    return { kind: "entry", ...migrated }
  })
}
