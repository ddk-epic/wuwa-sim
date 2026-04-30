import { describe, expect, it } from "vitest"
import type { DamageEntry } from "../src/types/echo.js"
import { formatStage } from "./generate-echo.js"

const noHits: DamageEntry[] = []

const singleHit: DamageEntry[] = [
  {
    type: "Echo Skill",
    dmgType: "Damage",
    scalingStat: "ATK",
    actionFrame: 0,
    value: 1.0,
    energy: 1.0,
    concerto: 0,
    toughness: 0.5,
    weakness: 0,
  },
]

describe("formatStage", () => {
  it("emits empty newName for Tap", () => {
    const out = formatStage("Tap", noHits, 1)
    expect(out).toContain('newName: "",')
  })

  it("does not emit hidden field for Tap (hidden defaults to false)", () => {
    const out = formatStage("Tap", noHits, 1)
    expect(out).not.toContain("hidden:")
  })

  it("emits parenthesised newName for Hold", () => {
    const out = formatStage("Hold", noHits, 1, "(Hold)", true)
    expect(out).toContain('newName: "(Hold)",')
  })

  it("emits hidden: true for Hold when hidden=true", () => {
    const out = formatStage("Hold", noHits, 1, "(Hold)", true)
    expect(out).toContain("hidden: true,")
  })

  it("emits actionFrame: 0 for each DamageEntry", () => {
    const out = formatStage("Tap", singleHit, 1)
    expect(out).toContain("actionFrame: 0,")
  })

  it("emits actionFrame: 0 before value in each DamageEntry", () => {
    const out = formatStage("Tap", singleHit, 1)
    const actionFramePos = out.indexOf("actionFrame: 0,")
    const valuePos = out.indexOf("value: 1,")
    expect(actionFramePos).toBeGreaterThan(-1)
    expect(actionFramePos).toBeLessThan(valuePos)
  })
})
