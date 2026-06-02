import { ELEMENT_HEX } from "#/data/elements"
import type { Element } from "#/data/elements"
import type { Member } from "./types"

export function elementHex(element: string): string {
  return ELEMENT_HEX[element as Element] ?? "#888"
}

export const TYPE_COLORS: Record<string, string> = {
  // Common skill types — rainbow hues.
  "Basic Attack": "#3b82f6", // blue
  "Heavy Attack": "#ef4444", // red
  "Resonance Skill": "#22c55e", // green
  "Resonance Liberation": "#eab308", // yellow
  // situational — exotic hues.
  "Intro Skill": "#06b6d4", // cyan
  "Forte Circuit": "#f97316", // orange
  "Echo Skill": "#8b5cf6", // violet
  "Outro Skill": "#ec4899", // magenta
}

export function portraitSrc(name: string): string {
  return `/portraits/${name.toLowerCase()}.png`
}

export const TEXT_OVER_PORTRAIT =
  "0 1px 5px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.65)"

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
