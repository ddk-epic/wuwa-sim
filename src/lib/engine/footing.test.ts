// @vitest-environment node
import { describe, expect, it } from "vitest"
import { FootingModule } from "./footing"

describe("FootingModule.applyStageFooting", () => {
  it("sustained air writes air exit footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    expect(f.team()).toBe("air")
  })

  it("sustained ground writes ground exit footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyStageFooting("ground", 60)
    expect(f.team()).toBe("ground")
  })

  it("either preserves the current footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyStageFooting("either", 60)
    expect(f.team()).toBe("air")
  })

  it("{ launch } within the stage lifts off, { land } settles", () => {
    const f = new FootingModule()
    f.applyStageFooting({ launch: 30 }, 60)
    expect(f.team()).toBe("air")
    f.applyStageFooting({ land: 30 }, 60)
    expect(f.team()).toBe("ground")
  })

  it("a launch committing after the stage ends does not flip footing", () => {
    const f = new FootingModule()
    f.applyStageFooting({ launch: 90 }, 60)
    expect(f.team()).toBe("ground")
  })

  it("omitted footing grounds the field", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyStageFooting(undefined, 60)
    expect(f.team()).toBe("ground")
  })
})

describe("FootingModule.enterIntro", () => {
  it("writes the intro's air exit footing", () => {
    const f = new FootingModule()
    f.enterIntro("air")
    expect(f.team()).toBe("air")
  })

  it("writes the intro's ground exit footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.enterIntro("ground")
    expect(f.team()).toBe("ground")
  })

  it("{ launch } intro lifts off, { land } intro settles", () => {
    const f = new FootingModule()
    f.enterIntro({ launch: 30 })
    expect(f.team()).toBe("air")
    f.enterIntro({ land: 30 })
    expect(f.team()).toBe("ground")
  })

  it("an untagged intro grounds the field", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.enterIntro(undefined)
    expect(f.team()).toBe("ground")
  })

  it("an either intro keeps the current footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.enterIntro("either")
    expect(f.team()).toBe("air")
  })
})
