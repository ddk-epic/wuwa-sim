// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  DEFAULT_SETTINGS,
  applySettingsPatch,
  coerceStoredSettings,
} from "./settings"

describe("coerceStoredSettings", () => {
  it("returns the constant defaults for null/non-object input", () => {
    expect(coerceStoredSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(coerceStoredSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(coerceStoredSettings(42)).toEqual(DEFAULT_SETTINGS)
  })

  it("merges a partial object over defaults", () => {
    expect(coerceStoredSettings({ reactionDelay: 9 })).toEqual({
      ...DEFAULT_SETTINGS,
      reactionDelay: 9,
    })
  })

  it("carries startWithFullEnergy through", () => {
    expect(
      coerceStoredSettings({ startWithFullEnergy: true }).startWithFullEnergy,
    ).toBe(true)
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

  it("restores every field when patched with the full defaults", () => {
    const edited = applySettingsPatch(DEFAULT_SETTINGS, {
      reactionDelay: 30,
      startWithFullEnergy: true,
    })
    expect(applySettingsPatch(edited, DEFAULT_SETTINGS)).toEqual(
      DEFAULT_SETTINGS,
    )
  })
})
