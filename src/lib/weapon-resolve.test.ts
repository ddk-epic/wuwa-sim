import { describe, expect, it } from "vitest"
import type { WeaponData, WeaponValueExpr } from "#/types/weapon"
import { resolveWeaponBuffs } from "./weapon-resolve"

const weaponEffect = (value: WeaponValueExpr) => ({
  kind: "stat" as const,
  path: { stat: "atkPct" as const },
  value,
})

const weaponBuff = (id: string, value: WeaponValueExpr) => ({
  id,
  name: id,
  trigger: { event: "simStart" as const },
  target: { kind: "self" as const },
  duration: { kind: "permanent" as const },
  effects: [weaponEffect(value)],
})

const weapon = (...buffs: WeaponData["buffs"]): WeaponData => ({
  id: 1,
  name: "W",
  weaponType: "Rectifier",
  stats: {
    main: { name: "ATK", base: 0, max: 0 },
    sub: { name: "Crit. Rate", base: 0, max: 0 },
  },
  passive: { name: "" },
  buffs,
})

describe("resolveWeaponBuffs", () => {
  it("resolves const array v for all 5 ranks", () => {
    const values = [0.1, 0.15, 0.18, 0.21, 0.24]
    for (let rank = 1; rank <= 5; rank++) {
      const result = resolveWeaponBuffs(
        weapon(weaponBuff("b", { kind: "const", v: values })),
        rank,
      )
      expect(result[0].effects[0]).toMatchObject({
        value: { kind: "const", v: values[rank - 1] },
      })
    }
  })

  it("resolves perStack array v for all 5 ranks", () => {
    const values = [0.12, 0.15, 0.18, 0.21, 0.24]
    for (let rank = 1; rank <= 5; rank++) {
      const result = resolveWeaponBuffs(
        weapon(weaponBuff("b", { kind: "perStack", v: values })),
        rank,
      )
      expect(result[0].effects[0]).toMatchObject({
        value: { kind: "perStack", v: values[rank - 1] },
      })
    }
  })

  it("leaves scalar v unchanged", () => {
    const result = resolveWeaponBuffs(
      weapon(weaponBuff("b", { kind: "const", v: 0.5 })),
      3,
    )
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.5 },
    })
  })

  it("handles multi-effect buffs — resolves each array independently", () => {
    const multi = {
      id: "b",
      name: "b",
      trigger: { event: "simStart" as const },
      target: { kind: "self" as const },
      duration: { kind: "permanent" as const },
      effects: [
        weaponEffect({ kind: "const", v: [0.1, 0.12, 0.14, 0.16, 0.18] }),
        weaponEffect({ kind: "const", v: [0.2, 0.22, 0.24, 0.26, 0.28] }),
      ],
    }
    const result = resolveWeaponBuffs(weapon(multi), 2)
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.12 },
    })
    expect(result[0].effects[1]).toMatchObject({
      value: { kind: "const", v: 0.22 },
    })
  })

  it("handles multi-buff weapons", () => {
    const w = weapon(
      weaponBuff("b1", { kind: "const", v: [0.1, 0.1, 0.1, 0.1, 0.1] }),
      weaponBuff("b2", { kind: "const", v: [0.2, 0.2, 0.2, 0.2, 0.2] }),
    )
    const result = resolveWeaponBuffs(w, 1)
    expect(result).toHaveLength(2)
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.1 },
    })
    expect(result[1].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.2 },
    })
  })

  it("throws on rank 0", () => {
    expect(() =>
      resolveWeaponBuffs(
        weapon(
          weaponBuff("b", { kind: "const", v: [0.1, 0.1, 0.1, 0.1, 0.1] }),
        ),
        0,
      ),
    ).toThrow("rank")
  })

  it("throws on rank 6", () => {
    expect(() =>
      resolveWeaponBuffs(
        weapon(
          weaponBuff("b", { kind: "const", v: [0.1, 0.1, 0.1, 0.1, 0.1] }),
        ),
        6,
      ),
    ).toThrow("rank")
  })

  it("throws when array v has length !== 5", () => {
    expect(() =>
      resolveWeaponBuffs(
        weapon(weaponBuff("b", { kind: "const", v: [0.1, 0.2, 0.3] })),
        1,
      ),
    ).toThrow("5")
  })

  it("does not mutate the original buff def", () => {
    const original = weaponBuff("b", {
      kind: "const",
      v: [0.1, 0.15, 0.18, 0.21, 0.24],
    })
    const w = weapon(original)
    resolveWeaponBuffs(w, 3)
    expect(original.effects[0]).toMatchObject({
      value: { v: [0.1, 0.15, 0.18, 0.21, 0.24] },
    })
  })
})
