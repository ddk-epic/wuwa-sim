import { ELEMENT_HEX } from "#/data/elements"
import type { Element } from "#/data/elements"
import { getCharacterById } from "#/lib/loadout/catalog"
import { GLOBAL_TARGET_ID } from "#/types/buff"

export const TEAM_HEX = "#60a5fa" // text-blue-400

export function elementHex(element: string): string {
  return ELEMENT_HEX[element as Element] ?? "#888"
}

export function portraitSrc(name: string): string {
  return `/portraits/${name.toLowerCase()}.png`
}

export function nameInitial(name: string): string {
  return name.at(0)?.toUpperCase() ?? "?"
}

export function elementLetter(element: string): string {
  return element.at(0) ?? "?"
}

export interface CharacterVisual {
  name: string
  element: string
  hex: string
  portraitSrc: string
  initial: string
  letter: string
  /** The team-wide (global) buff lane; renders an icon */
  isTeam: boolean
}

/**
 * Resolves a character id to its visual identity bundle. The global sentinel id
 * resolves to the Team identity; an unknown id renders neutrally.
 */
export function characterVisual(id: number): CharacterVisual {
  if (id === GLOBAL_TARGET_ID) {
    return {
      name: "Team",
      element: "SHARED",
      hex: TEAM_HEX,
      portraitSrc: "",
      initial: "T",
      letter: "T",
      isTeam: true,
    }
  }
  const c = getCharacterById(id)
  if (!c) {
    const name = `#${id}`
    return {
      name,
      element: "",
      hex: "#888",
      portraitSrc: portraitSrc(name),
      initial: "?",
      letter: "?",
      isTeam: false,
    }
  }
  return {
    name: c.name,
    element: c.element,
    hex: elementHex(c.element),
    portraitSrc: portraitSrc(c.name),
    initial: nameInitial(c.name),
    letter: elementLetter(c.element),
    isTeam: false,
  }
}
