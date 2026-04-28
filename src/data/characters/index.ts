import type { EnrichedCharacter } from '#/types/character'
import { enrichCharacters } from './enrichCharacters'
import { SKILL_METADATA } from './skill-metadata'
import encoreData from './encore.json'
import sanhuaData from './sanhua.json'

const rawCharacters = [encoreData, sanhuaData]

export const ALL_CHARACTERS: EnrichedCharacter[] = enrichCharacters(
  rawCharacters,
  SKILL_METADATA,
)
