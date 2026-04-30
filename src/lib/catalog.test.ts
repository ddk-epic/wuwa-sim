import { describe, expect, it } from "vitest"
import {
  getCharacterById,
  getWeaponById,
  getEchoById,
  getEchoSetById,
  findWeaponByName,
  findEchoByName,
  findEchoSetByName,
  listCharacters,
  listWeapons,
  listEchoes,
  listEchoSets,
  listWeaponsByType,
  getEchoSetForEcho,
} from "./catalog"
import { ALL_CHARACTERS } from "#/data/characters/index"
import { ALL_WEAPONS } from "#/data/weapons/index"
import { ALL_ECHOES } from "#/data/echoes/index"
import { ALL_ECHO_SETS } from "#/data/echo-sets/index"

describe("catalog — id lookups", () => {
  it("getCharacterById returns the matching character", () => {
    const character = ALL_CHARACTERS[0]
    expect(getCharacterById(character.id)).toBe(character)
  })

  it("getCharacterById returns null for an unknown id", () => {
    expect(getCharacterById(-1)).toBeNull()
  })

  it("getWeaponById returns the matching weapon", () => {
    const weapon = ALL_WEAPONS[0]
    expect(getWeaponById(weapon.id)).toBe(weapon)
  })

  it("getWeaponById returns null for an unknown id", () => {
    expect(getWeaponById(-1)).toBeNull()
  })

  it("getEchoById returns the matching echo", () => {
    const echo = ALL_ECHOES[0]
    expect(getEchoById(echo.id)).toBe(echo)
  })

  it("getEchoById returns null for an unknown id", () => {
    expect(getEchoById(-1)).toBeNull()
  })

  it("getEchoSetById returns the matching echo set", () => {
    const echoSet = ALL_ECHO_SETS[0]
    expect(getEchoSetById(echoSet.id)).toBe(echoSet)
  })

  it("getEchoSetById returns null for an unknown id", () => {
    expect(getEchoSetById(-1)).toBeNull()
  })
})

describe("catalog — name lookups", () => {
  it("findWeaponByName returns the matching weapon", () => {
    const weapon = ALL_WEAPONS[0]
    expect(findWeaponByName(weapon.name)).toBe(weapon)
  })

  it("findWeaponByName returns null for an unknown name", () => {
    expect(findWeaponByName("Nonexistent Weapon")).toBeNull()
  })

  it("findEchoByName returns the matching echo", () => {
    const echo = ALL_ECHOES[0]
    expect(findEchoByName(echo.name)).toBe(echo)
  })

  it("findEchoByName returns null for an unknown name", () => {
    expect(findEchoByName("Nonexistent Echo")).toBeNull()
  })

  it("findEchoSetByName returns the matching echo set", () => {
    const echoSet = ALL_ECHO_SETS[0]
    expect(findEchoSetByName(echoSet.name)).toBe(echoSet)
  })

  it("findEchoSetByName returns null for an unknown name", () => {
    expect(findEchoSetByName("Nonexistent Set")).toBeNull()
  })
})

describe("catalog — list queries", () => {
  it("listCharacters returns all characters", () => {
    expect(listCharacters()).toEqual(ALL_CHARACTERS)
  })

  it("listWeapons returns all weapons", () => {
    expect(listWeapons()).toEqual(ALL_WEAPONS)
  })

  it("listEchoes returns all echoes", () => {
    expect(listEchoes()).toEqual(ALL_ECHOES)
  })

  it("listEchoSets returns all echo sets", () => {
    expect(listEchoSets()).toEqual(ALL_ECHO_SETS)
  })
})

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
    const echo = ALL_ECHOES.find((e) => e.set === ALL_ECHO_SETS[0].name)
    expect(echo).toBeDefined()
    if (!echo) return
    expect(getEchoSetForEcho(echo)).toBe(ALL_ECHO_SETS[0])
  })

  it("returns null when the echo references an unknown set", () => {
    const echo = { ...ALL_ECHOES[0], set: "Nonexistent Set" }
    expect(getEchoSetForEcho(echo)).toBeNull()
  })
})
