import { describe, expect, it } from "vitest"
import { ALL_ECHO_SETS } from "./index"

describe("ALL_ECHO_SETS — shape sanity", () => {
  it("set ids are unique", () => {
    const ids = ALL_ECHO_SETS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("buff ids are unique across all sets", () => {
    const buffIds = ALL_ECHO_SETS.flatMap((s) => s.buffs.map((b) => b.id))
    expect(new Set(buffIds).size).toBe(buffIds.length)
  })

  it("every buff carries a valid requiresPieces (2, 3, or 5)", () => {
    for (const set of ALL_ECHO_SETS) {
      for (const buff of set.buffs) {
        expect(buff.requiresPieces).toBeDefined()
        expect([2, 3, 5]).toContain(buff.requiresPieces)
      }
    }
  })

  it("every buff's requiresPieces matches a declared effect tier", () => {
    for (const set of ALL_ECHO_SETS) {
      const tiers = new Set(set.effects.map((e) => e.pieces))
      for (const buff of set.buffs) {
        expect(tiers.has(buff.requiresPieces!)).toBe(true)
      }
    }
  })
})
