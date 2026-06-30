// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { BuffDef } from "#/types/buff"
import type { EchoSet, EnrichedEcho } from "#/types/echo"
import {
  resolveEchoBuffs,
  resolveEchoSetBuffs,
  resolveEchoSets,
} from "./resolve-echo"

let testEchoSets: EchoSet[] = []

vi.mock("./catalog", () => ({
  getEchoSetById: (id: number) => testEchoSets.find((s) => s.id === id) ?? null,
}))

afterEach(() => {
  testEchoSets = []
})

const twoFiveA: EchoSet = {
  id: 1,
  name: "Set A",
  type: "two-five",
  effects: [],
  buffs: [],
}
const twoFiveB: EchoSet = {
  id: 2,
  name: "Set B",
  type: "two-five",
  effects: [],
  buffs: [],
}
const threeOnly: EchoSet = {
  id: 3,
  name: "Set Z",
  type: "three-only",
  effects: [],
  buffs: [],
}

describe("resolveEchoSets", () => {
  it("empty + empty → nothing", () => {
    expect(resolveEchoSets(null, null)).toEqual([])
  })

  it("2/5 X + 2/5 X (same id) → X at 5pc", () => {
    testEchoSets = [twoFiveA]
    expect(resolveEchoSets(1, 1)).toEqual([{ setId: 1, effectivePieces: 5 }])
  })

  it("2/5 X + 2/5 Y (different ids) → X at 2pc + Y at 2pc", () => {
    testEchoSets = [twoFiveA, twoFiveB]
    expect(resolveEchoSets(1, 2)).toEqual([
      { setId: 1, effectivePieces: 2 },
      { setId: 2, effectivePieces: 2 },
    ])
  })

  it("2/5 X + 3-only Z → X at 2pc + Z at 3pc", () => {
    testEchoSets = [twoFiveA, threeOnly]
    expect(resolveEchoSets(1, 3)).toEqual([
      { setId: 1, effectivePieces: 2 },
      { setId: 3, effectivePieces: 3 },
    ])
  })

  it("2/5 X + empty → X at 2pc only", () => {
    testEchoSets = [twoFiveA]
    expect(resolveEchoSets(1, null)).toEqual([{ setId: 1, effectivePieces: 2 }])
  })

  it("3-only Z + empty → Z at 3pc", () => {
    testEchoSets = [threeOnly]
    expect(resolveEchoSets(3, null)).toEqual([{ setId: 3, effectivePieces: 3 }])
  })

  it("3-only + 3-only → warns, slot 1 at 3pc, slot 2 dropped", () => {
    const threeOnlyB: EchoSet = {
      id: 4,
      name: "Set W",
      type: "three-only",
      effects: [],
      buffs: [],
    }
    testEchoSets = [threeOnly, threeOnlyB]
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const result = resolveEchoSets(3, 4)
    expect(warnSpy).toHaveBeenCalled()
    expect(result).toEqual([{ setId: 3, effectivePieces: 3 }])
    warnSpy.mockRestore()
  })

  it("3-only Z + 2/5 X → Z at 3pc + X at 2pc", () => {
    testEchoSets = [threeOnly, twoFiveA]
    expect(resolveEchoSets(3, 1)).toEqual([
      { setId: 3, effectivePieces: 3 },
      { setId: 1, effectivePieces: 2 },
    ])
  })

  it("empty + 2/5 X → X at 2pc (slot 2 only)", () => {
    testEchoSets = [twoFiveA]
    expect(resolveEchoSets(null, 1)).toEqual([{ setId: 1, effectivePieces: 2 }])
  })
})

const permBuff = (id: string): BuffDef => ({
  id,
  name: id,
  trigger: { event: "simStart" },
  target: { kind: "self" },
  duration: { kind: "permanent" },
  effects: [],
})

const twoFiveWithBuffs = (id: number, buffs: BuffDef[]): EchoSet => ({
  id,
  name: `Set${id}`,
  type: "two-five",
  effects: [],
  buffs,
})

const echoWithBuffs = (buffs: BuffDef[]): EnrichedEcho => ({
  id: 20,
  name: "TestEcho",
  cost: 3,
  element: "Glacio",
  sets: ["TestSet"],
  buffs,
  skill: { cooldown: 20, description: "", stages: [] },
})

describe("resolveEchoBuffs", () => {
  it("returns the echo's compiled buffs", () => {
    const buff = permBuff("echo.buff")
    expect(resolveEchoBuffs(echoWithBuffs([buff]))).toContainEqual(buff)
  })

  it("returns empty when the echo has no buffs", () => {
    expect(resolveEchoBuffs(echoWithBuffs([]))).toHaveLength(0)
  })
})

describe("resolveEchoSetBuffs", () => {
  it("returns empty when both slots are null", () => {
    expect(resolveEchoSetBuffs(null, null)).toHaveLength(0)
  })

  it("includes a 5pc buff when both slots share one two-five set", () => {
    const fivePc: BuffDef = { ...permBuff("set.5pc"), requiresPieces: 5 }
    testEchoSets = [twoFiveWithBuffs(1, [fivePc])]
    expect(resolveEchoSetBuffs(1, 1)).toContainEqual(fivePc)
  })

  it("excludes a 5pc buff when two different sets give 2 pieces each", () => {
    const fivePc: BuffDef = { ...permBuff("set.5pc"), requiresPieces: 5 }
    const twoPc: BuffDef = { ...permBuff("set.2pc"), requiresPieces: 2 }
    testEchoSets = [
      twoFiveWithBuffs(1, [fivePc, twoPc]),
      twoFiveWithBuffs(2, []),
    ]
    const result = resolveEchoSetBuffs(1, 2)
    expect(result).toContainEqual(twoPc)
    expect(result).not.toContainEqual(fivePc)
  })
})
