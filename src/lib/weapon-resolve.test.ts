import { describe, expect, it } from "vitest"
import type { BuffDef } from "#/types/buff"
import { resolveWeaponBuffs } from "./weapon-resolve"

const byRankEffect = (values: number[]) => ({
  kind: "stat" as const,
  path: { stat: "atkPct" as const },
  value: { kind: "byRank" as const, values },
})

const constEffect = (v: number) => ({
  kind: "stat" as const,
  path: { stat: "atkPct" as const },
  value: { kind: "const" as const, v },
})

const buff = (id: string, ...effects: BuffDef["effects"]): BuffDef => ({
  id,
  name: id,
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: effects,
})

const weapon = (...buffs: BuffDef[]) => ({ buffs })

describe("resolveWeaponBuffs", () => {
  it("resolves byRank rank 1 to values[0]", () => {
    const result = resolveWeaponBuffs(
      weapon(buff("b", byRankEffect([0.1, 0.15, 0.18, 0.21, 0.24]))),
      1,
    )
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.1 },
    })
  })

  it("resolves byRank rank 5 to values[4]", () => {
    const result = resolveWeaponBuffs(
      weapon(buff("b", byRankEffect([0.1, 0.15, 0.18, 0.21, 0.24]))),
      5,
    )
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.24 },
    })
  })

  it("resolves all 5 ranks correctly", () => {
    const values = [0.1, 0.15, 0.18, 0.21, 0.24]
    for (let rank = 1; rank <= 5; rank++) {
      const result = resolveWeaponBuffs(
        weapon(buff("b", byRankEffect(values))),
        rank,
      )
      expect(result[0].effects[0]).toMatchObject({
        value: { kind: "const", v: values[rank - 1] },
      })
    }
  })

  it("leaves non-byRank effects unchanged", () => {
    const result = resolveWeaponBuffs(weapon(buff("b", constEffect(0.5))), 3)
    expect(result[0].effects[0]).toMatchObject({
      value: { kind: "const", v: 0.5 },
    })
  })

  it("handles multi-effect buffs — resolves each byRank independently", () => {
    const multi = buff(
      "b",
      byRankEffect([0.1, 0.12, 0.14, 0.16, 0.18]),
      byRankEffect([0.2, 0.22, 0.24, 0.26, 0.28]),
    )
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
      buff("b1", byRankEffect([0.1, 0.1, 0.1, 0.1, 0.1])),
      buff("b2", byRankEffect([0.2, 0.2, 0.2, 0.2, 0.2])),
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
        weapon(buff("b", byRankEffect([0.1, 0.1, 0.1, 0.1, 0.1]))),
        0,
      ),
    ).toThrow("rank")
  })

  it("throws on rank 6", () => {
    expect(() =>
      resolveWeaponBuffs(
        weapon(buff("b", byRankEffect([0.1, 0.1, 0.1, 0.1, 0.1]))),
        6,
      ),
    ).toThrow("rank")
  })

  it("throws on values.length !== 5", () => {
    expect(() =>
      resolveWeaponBuffs(weapon(buff("b", byRankEffect([0.1, 0.2, 0.3]))), 1),
    ).toThrow("5")
  })

  it("does not mutate the original buff def", () => {
    const original = buff("b", byRankEffect([0.1, 0.15, 0.18, 0.21, 0.24]))
    const w = weapon(original)
    resolveWeaponBuffs(w, 3)
    expect(original.effects[0]).toMatchObject({ value: { kind: "byRank" } })
  })
})
