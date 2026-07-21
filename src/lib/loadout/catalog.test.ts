// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  findEchoSetByName,
  listWeaponsByType,
  getEchoSetForEcho,
} from "./catalog"
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
})

describe("catalog — getEchoSetForEcho", () => {
  it("returns the EchoSet whose name matches the echo's set", () => {
    const echo = ALL_ECHOES.find((e) => e.sets.includes(ALL_ECHO_SETS[0].name))
    expect(echo).toBeDefined()
    if (!echo) return
    expect(getEchoSetForEcho(echo)).toBe(ALL_ECHO_SETS[0])
  })
})

describe("catalog — echo/echo-set referential integrity", () => {
  // Per name, not via getEchoSetForEcho: that returns the first name that
  // resolves, so a missing set on a two-set echo would slip through.
  it("every set name an echo declares resolves to a registered set", () => {
    for (const echo of ALL_ECHOES) {
      for (const setName of echo.sets) {
        expect(
          findEchoSetByName(setName),
          `${echo.name} -> ${setName}`,
        ).not.toBeNull()
      }
    }
  })

  it("every registered set carries buffs", () => {
    for (const set of ALL_ECHO_SETS) {
      expect(set.buffs.length, set.name).toBeGreaterThan(0)
    }
  })
})

describe("catalog — ALL_WEAPONS data shape invariants", () => {
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
