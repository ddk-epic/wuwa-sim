import { getCharacterById } from "#/lib/loadout/catalog"
import { compileCharacter } from "#/lib/compile-character"
import type { StageInfo } from "#/lib/compile-character"
import { splitRotations } from "#/types/timeline"
import type { TimelineEntry, TimelineNode } from "#/types/timeline"
import type { SkillCategory, SkillGrouping } from "#/types/character"

export interface RotationCard {
  characterId: number
  /** Action glyphs for the stint, in order. Empty only on an intro-only card. */
  letters: string
  /** Stint opens on an Intro Skill; rendered as an `IN` badge, not a letter. */
  hasIntro: boolean
}

export interface RotationCards {
  opener: RotationCard[]
  loop: RotationCard[]
}

// No model field marks a forte activation; the parent skill grouping is the
// closest signal. Correct for every implemented character but Cartethyia, whose
// transformed moveset is wholly authored under Forte Circuit.
function glyphFor(
  grouping: SkillGrouping,
  category: SkillCategory,
): string | null {
  if (grouping === "Forte Circuit") return "Z"
  switch (category) {
    case "Basic Attack":
      return "A"
    case "Heavy Attack":
      return "H"
    case "Resonance Skill":
      return "E"
    case "Resonance Liberation":
      return "R"
    case "Echo Skill":
      return "Q"
    default:
      return null
  }
}

function resolveStage(entry: TimelineEntry): StageInfo | null {
  const char = getCharacterById(entry.characterId)
  return char
    ? (compileCharacter(char).stageIndex.get(entry.stageId) ?? null)
    : null
}

function toCards(entries: TimelineEntry[]): RotationCard[] {
  const cards: RotationCard[] = []
  for (const entry of entries) {
    const info = resolveStage(entry)
    let card = cards.at(-1)
    if (!card || card.characterId !== entry.characterId) {
      card = {
        characterId: entry.characterId,
        letters: "",
        hasIntro: info?.stage.category === "Intro Skill",
      }
      cards.push(card)
    }
    const glyph = info && glyphFor(info.skill.type, info.stage.category)
    if (glyph) card.letters += glyph
  }
  return cards.filter((c) => c.letters !== "" || c.hasIntro)
}

/** Split the timeline at its loop marker into Opener/Loop, each as stint cards. */
export function rotationCards(nodes: TimelineNode[]): RotationCards {
  const { opener, loop } = splitRotations(nodes)
  return { opener: toCards(opener), loop: toCards(loop) }
}
