import { describe, expect, it } from "vitest"
import { listWeaponsByType, getEchoSetForEcho } from "./catalog"
import { ALL_WEAPONS } from "#/data/weapons/index"
import { ALL_ECHOES } from "#/data/echoes/index"
import { ALL_ECHO_SETS } from "#/data/echo-sets/index"

describe("catalog — listWeaponsByType", () => {
  it("returns only weapons whose weaponType matches", () => {
    const rectifiers = listWeaponsByType("Rectifier")
    expect(rectifiers.length).toBeGreaterThan(0)
    for (const w of rectifiers) {
      expect(w.weaponType).toBe("Rectifier")
    }
  })

  it("returns empty array for an unknown weapon type", () => {
    expect(listWeaponsByType("NonexistentType")).toEqual([])
  })
})

describe("catalog — getEchoSetForEcho", () => {
  it("returns the EchoSet whose name matches the echo's set", () => {
    const echo = ALL_ECHOES.find((e) => e.sets.includes(ALL_ECHO_SETS[0].name))
    expect(echo).toBeDefined()
    if (!echo) return
    expect(getEchoSetForEcho(echo)).toBe(ALL_ECHO_SETS[0])
  })

  it("returns null when the echo references an unknown set", () => {
    const echo = { ...ALL_ECHOES[0], sets: ["Nonexistent Set"] }
    expect(getEchoSetForEcho(echo)).toBeNull()
  })
})

describe("catalog — ALL_WEAPONS data shape invariants (#93)", () => {
  it("every weapon buff effect with array v has exactly 5 values", () => {
    for (const weapon of ALL_WEAPONS) {
      for (const buff of weapon.buffs) {
        for (const effect of buff.effects) {
          if (effect.kind !== "stat") continue
          if (!Array.isArray(effect.value.v)) continue
          expect(effect.value.v).toHaveLength(5)
        }
      }
    }
  })
})
