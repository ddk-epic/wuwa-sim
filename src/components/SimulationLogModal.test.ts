import { describe, expect, it } from "vitest"
import type { ActiveBuff } from "#/types/simulation-log"
import { formatActiveBuffLabel } from "./SimulationLogModal"

const resolveName = (id: number) => `Char${id}`

describe("formatActiveBuffLabel", () => {
  it("single-stack buff — no stacks suffix", () => {
    const b: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 1 }
    expect(formatActiveBuffLabel(b, [b], resolveName)).toBe("Power Up")
  })

  it("multi-stack buff — appends ×N suffix", () => {
    const b: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 3 }
    expect(formatActiveBuffLabel(b, [b], resolveName)).toBe("Power Up ×3")
  })

  it("no name collision — no source suffix even when sourceCharacterId present", () => {
    const b: ActiveBuff = {
      id: "a.buff",
      name: "Power Up",
      stacks: 1,
      sourceCharacterId: 1,
    }
    expect(formatActiveBuffLabel(b, [b], resolveName)).toBe("Power Up")
  })

  it("name collision — appends source-character suffix", () => {
    const b1: ActiveBuff = {
      id: "a.buff",
      name: "Power Up",
      stacks: 1,
      sourceCharacterId: 1,
    }
    const b2: ActiveBuff = {
      id: "b.buff",
      name: "Power Up",
      stacks: 1,
      sourceCharacterId: 2,
    }
    const all = [b1, b2]
    expect(formatActiveBuffLabel(b1, all, resolveName)).toBe(
      "Power Up (from Char1)",
    )
    expect(formatActiveBuffLabel(b2, all, resolveName)).toBe(
      "Power Up (from Char2)",
    )
  })

  it("name collision with stacks — both suffixes applied", () => {
    const b1: ActiveBuff = {
      id: "a.buff",
      name: "Surge",
      stacks: 2,
      sourceCharacterId: 1,
    }
    const b2: ActiveBuff = {
      id: "b.buff",
      name: "Surge",
      stacks: 1,
      sourceCharacterId: 2,
    }
    const all = [b1, b2]
    expect(formatActiveBuffLabel(b1, all, resolveName)).toBe(
      "Surge ×2 (from Char1)",
    )
  })

  it("name collision but no sourceCharacterId — no source suffix", () => {
    const b1: ActiveBuff = { id: "a.buff", name: "Power Up", stacks: 1 }
    const b2: ActiveBuff = { id: "b.buff", name: "Power Up", stacks: 1 }
    const all = [b1, b2]
    expect(formatActiveBuffLabel(b1, all, resolveName)).toBe("Power Up")
  })
})
