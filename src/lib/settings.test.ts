// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  DEFAULT_SETTINGS,
  applySettingsPatch,
  coerceStoredSettings,
} from "./settings"

describe("coerceStoredSettings", () => {
  it("merges a partial object over defaults", () => {
    expect(coerceStoredSettings({ reactionDelay: 9 })).toEqual({
      ...DEFAULT_SETTINGS,
      reactionDelay: 9,
    })
  })

  it("ignores a non-boolean startWithFullEnergy", () => {
    expect(
      coerceStoredSettings({ startWithFullEnergy: 1 }).startWithFullEnergy,
    ).toBe(false)
  })
})

describe("applySettingsPatch", () => {
  it("updates a single frame knob, leaving the rest", () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, { reactionDelay: 15 })
    expect(next.reactionDelay).toBe(15)
    expect(next.swapFrames).toBe(DEFAULT_SETTINGS.swapFrames)
  })

  it("clamps frame knobs to [0, 60] and rounds", () => {
    expect(
      applySettingsPatch(DEFAULT_SETTINGS, { swapFrames: -5 }).swapFrames,
    ).toBe(0)
    expect(
      applySettingsPatch(DEFAULT_SETTINGS, { variantFloor: 99 }).variantFloor,
    ).toBe(60)
    expect(
      applySettingsPatch(DEFAULT_SETTINGS, { fallFrames: 12.6 }).fallFrames,
    ).toBe(13)
  })

  it("toggles startWithFullEnergy without clamping", () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, {
      startWithFullEnergy: true,
    })
    expect(next.startWithFullEnergy).toBe(true)
  })
})
