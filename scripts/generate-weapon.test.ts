import { describe, expect, it } from "vitest"
import type { Weapon } from "../src/types/weapon.js"
import { formatWeapon } from "./generate-weapon.js"

const sampleWeapon: Weapon = {
  id: 21020015,
  name: "Emerald of Genesis",
  rarity: "SSR",
  weaponType: "Sword",
  stats: {
    main: { name: "ATK", base: 47, max: 587.5 },
    sub: { name: "Crit. Rate", base: 0.054, max: 0.243 },
  },
  passive: {
    name: "Stormy Resolution",
    description: "some description",
    params: [],
  },
}

describe("formatWeapon", () => {
  it("emits satisfies EnrichedWeapon", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain("satisfies EnrichedWeapon")
  })

  it("uses the provided variable name in the export", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain("export const emeraldOfGenesis =")
  })

  it("emits the weapon name", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain('name: "Emerald of Genesis"')
  })

  it("emits the weaponType", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain('weaponType: "Sword"')
  })

  it("emits main stats with base and max only", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain("main: { base: 47, max: 587.5 }")
  })

  it("emits sub stats with base and max only", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain("sub: { base: 0.054, max: 0.243 }")
  })

  it("emits passive name only", () => {
    const out = formatWeapon(sampleWeapon, "emeraldOfGenesis")
    expect(out).toContain('passive: { name: "Stormy Resolution" }')
  })
})
