import type { TimelineEntry } from "#/types/timeline"
import type { Slots } from "#/types/loadout"
import { ELEMENT_HEX } from "#/data/elements"
import { getCharacterById } from "#/lib/loadout/catalog"

export function getDistinctCharsBySlot(
  entries: TimelineEntry[],
  slots: Slots,
): number[] {
  const seen = new Set<number>()
  const charIds: number[] = []
  for (const e of entries) {
    if (!seen.has(e.characterId)) {
      seen.add(e.characterId)
      charIds.push(e.characterId)
    }
  }
  charIds.sort((a, b) => {
    const ia = slots.indexOf(a)
    const ib = slots.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return charIds
}

export function buildGroupGradient(
  groupEntries: TimelineEntry[],
  slots: Slots,
): string {
  const charIds = getDistinctCharsBySlot(groupEntries, slots)
  const hexes = charIds.map((id) => {
    const char = getCharacterById(id)
    return (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
  })
  if (hexes.length === 0) return "transparent"
  if (hexes.length === 1)
    return `linear-gradient(90deg, ${hexes[0]}3a 0%, ${hexes[0]}14 50%, transparent 95%)`
  const counts = new Map<number, number>()
  for (const e of groupEntries)
    counts.set(e.characterId, (counts.get(e.characterId) ?? 0) + 1)
  const total = charIds.reduce((s, id) => s + (counts.get(id) ?? 0), 0)
  let acc = 0
  const stops = charIds.map((id, i) => {
    const pct = ((counts.get(id) ?? 0) / total) * 95
    const mid = acc + pct / 2
    acc += pct
    return `${hexes[i]}3a ${mid.toFixed(1)}%`
  })
  return `linear-gradient(90deg, ${stops.join(", ")}, transparent 95%)`
}

export function getGroupFirstCharHex(
  groupEntries: TimelineEntry[],
  slots: Slots,
): string {
  const charIds = getDistinctCharsBySlot(groupEntries, slots)
  if (charIds.length === 0) return "#888"
  const char = getCharacterById(charIds[0])
  return (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
}

export function getDominantHex(groupEntries: TimelineEntry[]): string {
  if (groupEntries.length === 0) return "#888"
  const counts = new Map<number, number>()
  for (const e of groupEntries) {
    counts.set(e.characterId, (counts.get(e.characterId) ?? 0) + 1)
  }
  let maxCount = 0
  let dominantId = groupEntries[0].characterId
  for (const [id, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      dominantId = id
    }
  }
  const char = getCharacterById(dominantId)
  return (char?.element && ELEMENT_HEX[char.element]) ?? "#888"
}
