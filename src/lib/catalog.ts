import type { EnrichedCharacter } from "#/types/character"
import type { Weapon } from "#/types/weapon"
import type { EnrichedEcho, EchoSet } from "#/types/echo"
import { ALL_CHARACTERS } from "#/data/characters/index"
import { ALL_WEAPONS } from "#/data/weapons/index"
import { ALL_ECHOES } from "#/data/echoes/index"
import { ALL_ECHO_SETS } from "#/data/echo-sets/index"

export function getCharacterById(id: number): EnrichedCharacter | null {
  return ALL_CHARACTERS.find((c) => c.id === id) ?? null
}

export function getWeaponById(id: number): Weapon | null {
  return ALL_WEAPONS.find((w) => w.id === id) ?? null
}

export function getEchoById(id: number): EnrichedEcho | null {
  return ALL_ECHOES.find((e) => e.id === id) ?? null
}

export function getEchoSetById(id: number): EchoSet | null {
  return ALL_ECHO_SETS.find((s) => s.id === id) ?? null
}

export function findWeaponByName(name: string): Weapon | null {
  return ALL_WEAPONS.find((w) => w.name === name) ?? null
}

export function findEchoByName(name: string): EnrichedEcho | null {
  return ALL_ECHOES.find((e) => e.name === name) ?? null
}

export function findEchoSetByName(name: string): EchoSet | null {
  return ALL_ECHO_SETS.find((s) => s.name === name) ?? null
}

export function listCharacters(): EnrichedCharacter[] {
  return ALL_CHARACTERS
}

export function listWeapons(): Weapon[] {
  return ALL_WEAPONS
}

export function listEchoes(): EnrichedEcho[] {
  return ALL_ECHOES
}

export function listEchoSets(): EchoSet[] {
  return ALL_ECHO_SETS
}

export function listWeaponsByType(weaponType: string): Weapon[] {
  return ALL_WEAPONS.filter((w) => w.weaponType === weaponType)
}

export function getEchoSetForEcho(echo: EnrichedEcho): EchoSet | null {
  return findEchoSetByName(echo.set)
}
