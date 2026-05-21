import { getEchoSetById } from "./catalog"

export interface ResolvedSet {
  setId: number
  effectivePieces: number
}

export function resolveEchoSets(
  slot1Id: number | null,
  slot2Id: number | null,
): ResolvedSet[] {
  const set1 = slot1Id !== null ? getEchoSetById(slot1Id) : null
  const set2 = slot2Id !== null ? getEchoSetById(slot2Id) : null

  if (!set1 && !set2) return []

  if (set1 && !set2) {
    return [
      {
        setId: set1.id,
        effectivePieces: set1.type === "three-only" ? 3 : 2,
      },
    ]
  }

  if (!set1 && set2) {
    return [
      {
        setId: set2.id,
        effectivePieces: set2.type === "three-only" ? 3 : 2,
      },
    ]
  }

  const s1 = set1!
  const s2 = set2!

  if (s1.type === "three-only" && s2.type === "three-only") {
    console.warn(
      `Invalid loadout: two 3-only echo sets (${s1.name}, ${s2.name}). Dropping slot 2.`,
    )
    return [{ setId: s1.id, effectivePieces: 3 }]
  }

  if (s1.type === "two-five" && s2.type === "two-five") {
    if (s1.id === s2.id) {
      return [{ setId: s1.id, effectivePieces: 5 }]
    }
    return [
      { setId: s1.id, effectivePieces: 2 },
      { setId: s2.id, effectivePieces: 2 },
    ]
  }

  if (s1.type === "two-five" && s2.type === "three-only") {
    return [
      { setId: s1.id, effectivePieces: 2 },
      { setId: s2.id, effectivePieces: 3 },
    ]
  }

  // s1.type === "three-only" && s2.type === "two-five"
  return [
    { setId: s1.id, effectivePieces: 3 },
    { setId: s2.id, effectivePieces: 2 },
  ]
}
