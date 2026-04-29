import type { EnrichedCharacter } from '#/types/character'
import { enrichCharacters } from './enrichCharacters'
import { SKILL_METADATA } from './skill-metadata'
import encoreData from './raw/encore.json'
import sanhuaData from './raw/sanhua.json'

const rawCharacters = [encoreData, sanhuaData]

export const ALL_CHARACTERS: EnrichedCharacter[] = enrichCharacters(
  rawCharacters,
  SKILL_METADATA,
)
