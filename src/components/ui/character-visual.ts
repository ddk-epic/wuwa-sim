import { ELEMENT_HEX } from "#/data/elements"
import type { Element } from "#/data/elements"
import { getCharacterById } from "#/lib/loadout/catalog"

/** Element accent color, or a neutral gray for unknown elements. */
export function elementHex(element: string): string {
  return ELEMENT_HEX[element as Element] ?? "#888"
}

/** Portrait asset path for a character name. */
export function portraitSrc(name: string): string {
  return `/portraits/${name.toLowerCase()}.png`
}

/** First letter of a name, uppercased; `"?"` for an empty name. */
export function nameInitial(name: string): string {
  return name.at(0)?.toUpperCase() ?? "?"
}

/** First letter of an element; `"?"` for an empty element. */
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
}

/**
 * Resolves a character id to its visual identity bundle. An unknown id renders
 * neutrally (gray hex, `"?"` initial/letter, empty element) rather than
 * masquerading as a real-element character.
 */
export function characterVisual(id: number): CharacterVisual {
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
    }
  }
  return {
    name: c.name,
    element: c.element,
    hex: elementHex(c.element),
    portraitSrc: portraitSrc(c.name),
    initial: nameInitial(c.name),
    letter: elementLetter(c.element),
  }
}
