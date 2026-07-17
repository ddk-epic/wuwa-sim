// @vitest-environment node
import { describe, expect, it } from "vitest"
import type {
  WeaponBuffDef,
  WeaponData,
  WeaponEffect,
  WeaponValueExpr,
} from "#/types/weapon"
import { resolveWeaponBuffs } from "./resolve-weapon"

const weaponEffect = (value: WeaponValueExpr): WeaponEffect => ({
  kind: "stat",
  path: { stat: "atkPct" },
  value,
})

const weaponBuff = (id: string, value: WeaponValueExpr): WeaponBuffDef => ({
  id,
  name: id,
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
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

  it("leaves scalar v unchanged", () => {
    const result = resolveWeaponBuffs(
      weapon(weaponBuff("b", { kind: "const", v: 0.5 })),
      3,
    )
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.5 },
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

  it("resolves resource effect array v by rank", () => {
    const resourceBuff: WeaponBuffDef = {
      id: "test-resource",
      name: "test",
      trigger: {
        event: "skillCast",
        actor: "self",
        skillCategory: "Resonance Skill",
      },
      target: { kind: "self" },
      duration: { kind: "frames", v: 1 },
      cooldown: 20,
      effects: [
        {
          kind: "resource",
          resource: "concerto",
          op: "add",
          value: { kind: "const", v: [8, 10, 12, 14, 16] },
        },
      ],
    }
    const w = weapon(resourceBuff)
    for (let rank = 1; rank <= 5; rank++) {
      const resolved = resolveWeaponBuffs(w, rank)
      expect(resolved[0].effects[0]).toMatchObject({
        kind: "resource",
        value: { kind: "const", v: [8, 10, 12, 14, 16][rank - 1] },
      })
    }
  })
})
