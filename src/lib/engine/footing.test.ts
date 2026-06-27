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
    f.applyStageFooting({ entry: "ground", exit: "air", commit: 30 }, 60)
    expect(f.team()).toBe("air")
    f.applyStageFooting({ entry: "air", exit: "ground", commit: 30 }, 60)
    expect(f.team()).toBe("ground")
  })

  it("a launch committing after the stage ends does not flip footing", () => {
    const f = new FootingModule()
    f.applyStageFooting({ entry: "ground", exit: "air", commit: 90 }, 60)
    expect(f.team()).toBe("ground")
  })

  it("entry any commits to its exit footing from either footing", () => {
    const f = new FootingModule()
    f.applyStageFooting({ entry: "any", exit: "ground", commit: 0 }, 60)
    expect(f.team()).toBe("ground")
    f.applyStageFooting("air", 60)
    f.applyStageFooting({ entry: "any", exit: "ground", commit: 0 }, 60)
    expect(f.team()).toBe("ground")
  })

  it("omitted footing grounds the field", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyStageFooting(undefined, 60)
    expect(f.team()).toBe("ground")
  })
})

describe("FootingModule.applyIntroFooting", () => {
  it("writes the intro's air exit footing", () => {
    const f = new FootingModule()
    f.applyIntroFooting("air")
    expect(f.team()).toBe("air")
  })

  it("writes the intro's ground exit footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyIntroFooting("ground")
    expect(f.team()).toBe("ground")
  })

  it("{ launch } intro lifts off, { land } intro settles", () => {
    const f = new FootingModule()
    f.applyIntroFooting({ entry: "ground", exit: "air", commit: 30 })
    expect(f.team()).toBe("air")
    f.applyIntroFooting({ entry: "air", exit: "ground", commit: 30 })
    expect(f.team()).toBe("ground")
  })

  it("an untagged intro grounds the field", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyIntroFooting(undefined)
    expect(f.team()).toBe("ground")
  })

  it("an either intro keeps the current footing", () => {
    const f = new FootingModule()
    f.applyStageFooting("air", 60)
    f.applyIntroFooting("either")
    expect(f.team()).toBe("air")
  })
})
