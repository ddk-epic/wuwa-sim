import { ELEMENT_HEX } from "#/data/elements"
import type { Element } from "#/data/elements"
import type { Member } from "./types"

/** Element accent hex, falling back to a neutral grey for unknown elements. */
export function elementHex(element: string): string {
  return ELEMENT_HEX[element as Element] ?? "#888"
}

/** Per-Skill-Type colors for the distribution donut. */
export const TYPE_COLORS: Record<string, string> = {
  Intro: "#a3bfff",
  Basic: "#838899",
  Heavy: "#c89b5f",
  Resonance: "#9b6cf0",
  Forte: "#ff7a3d",
  Liberation: "#f5cf4d",
  Echo: "#5ad7f0",
  Outro: "#5fd49a",
}

/** Public portrait asset path for a character name (CharacterPortrait falls back on 404). */
export function portraitSrc(name: string): string {
  return `/portraits/${name.toLowerCase()}.png`
}

export const TEXT_OVER_PORTRAIT =
  "0 1px 5px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.65)"

/** A left-to-right element-tinted wash used behind team portraits. */
export function blendGradient(members: Member[], stops?: number[]): string {
  const aHex = (0x10).toString(16).padStart(2, "0")
  const n = members.length
  const stopList = members.map((m, i) => {
    const hex = elementHex(m.element)
    const pct = stops ? stops[i] : ((i + 0.5) / n) * 75
    return `${hex}${aHex} ${pct.toFixed(1)}%`
  })
  return `linear-gradient(90deg, ${stopList.join(", ")}, transparent 95%)`
}
