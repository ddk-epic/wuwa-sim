import type { EnrichedCharacter } from "#/types/character"
import { DODGE_SKILL, JUMP_SKILL } from "#/data/movement"
import { encore } from "./encore"
import { sanhua } from "./sanhua"
import { shorekeeper } from "./shorekeeper"
import { verina } from "./verina"

function injectMovement(char: EnrichedCharacter): EnrichedCharacter {
  return { ...char, skills: [...char.skills, DODGE_SKILL, JUMP_SKILL] }
}

export const ALL_CHARACTERS: EnrichedCharacter[] = [
  encore,
  sanhua,
  verina,
  shorekeeper,
].map(injectMovement)
