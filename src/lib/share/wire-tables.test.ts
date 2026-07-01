import { describe, expect, it } from "vitest"
import { ALL_CHARACTERS } from "#/data/characters"
import { ALL_WEAPONS } from "#/data/weapons"
import { ALL_ECHOES } from "#/data/echoes"
import { ALL_ECHO_SETS } from "#/data/echo-sets"
import { ECHO_BUILD_LIST } from "#/lib/loadout/echo-stat-constants"
import { compileCharacter } from "#/lib/compile-character"
import {
  BUILD_WIRE_ORDER,
  CHARACTER_WIRE,
  COST3_MAINS,
  COST4_MAINS,
  ECHO_SET_WIRE,
  ECHO_WIRE,
  SKILL_WIRE,
  VARIANT_KINDS,
  WEAPON_WIRE,
} from "./wire-tables"

const registries = [
  ["CHARACTER_WIRE", CHARACTER_WIRE, ALL_CHARACTERS],
  ["WEAPON_WIRE", WEAPON_WIRE, ALL_WEAPONS],
  ["ECHO_WIRE", ECHO_WIRE, ALL_ECHOES],
  ["ECHO_SET_WIRE", ECHO_SET_WIRE, ALL_ECHO_SETS],
] as const

describe.each(registries)("%s", (_name, wire, live) => {
  // A live id missing from the wire table would make encode throw at runtime.
  it("covers every live id", () => {
    for (const { id } of live) expect(wire).toContain(id)
  })

  it("has no duplicate ids", () => {
    expect(new Set(wire).size).toBe(wire.length)
  })
})

describe("SKILL_WIRE", () => {
  // Every stage-bearing skill a character can cast must have a wire slot, else
  // encoding a timeline entry for that stage throws.
  it("covers every stage-bearing skill of every character", () => {
    for (const char of ALL_CHARACTERS) {
      const wire = SKILL_WIRE[char.id] ?? []
      for (const info of compileCharacter(char).stageIndex.values())
        expect(wire).toContain(info.skill.id)
    }
  })

  it("has no duplicate skill ids per character", () => {
    for (const wire of Object.values(SKILL_WIRE))
      expect(new Set(wire).size).toBe(wire.length)
  })
})

describe("enum wire orders", () => {
  // Frozen prefixes: appending is fine, reordering these lines trips the test.
  it("BUILD_WIRE_ORDER is append-only and covers every build", () => {
    expect(BUILD_WIRE_ORDER.slice(0, 2)).toEqual(["4-3-3-1-1", "4-4-1-1-1"])
    for (const build of ECHO_BUILD_LIST)
      expect(BUILD_WIRE_ORDER).toContain(build)
  })

  it("main-stat and variant orders are frozen", () => {
    expect(COST4_MAINS.slice(0, 3)).toEqual(["scaling", "cr", "cd"])
    expect(COST3_MAINS.slice(0, 3)).toEqual(["scaling", "er", "elemDmg"])
    expect(VARIANT_KINDS.slice(0, 3)).toEqual([
      "cancel",
      "instantCancel",
      "swap",
    ])
  })
})
