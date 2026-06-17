import { describe, expect, it } from "vitest"
import { sanhua } from "#/data/characters/sanhua"
import { coverageOf, planClips } from "./planner"
import type { SuggestedClip } from "./planner"
import type { Clip } from "./types"

const labels = (s: SuggestedClip) => s.stages.map((st) => st.label)
const find = (plan: SuggestedClip[], first: string) =>
  plan.find((s) => s.stages[0]?.label === first)!

describe("planClips — Sanhua", () => {
  const plan = planClips(sanhua)

  it("covers the character in four clips", () => {
    expect(plan).toHaveLength(4)
  })

  it("emits the basic combo as one chain clip", () => {
    const chain = find(plan, "Stage 1")
    expect(labels(chain)).toEqual([
      "Stage 1",
      "Stage 2",
      "Stage 3",
      "Stage 4",
      "Stage 5",
    ])
    // Combo links are proven — no verify badge anywhere in the chain.
    expect(chain.stages.every((st) => !st.verify)).toBe(true)
    expect(chain.preconditions).toEqual([])
  })

  it("packs liberation → skill → heavies behind a full-energy clip", () => {
    const packed = find(plan, "Glacial Gaze")
    expect(labels(packed)).toEqual([
      "Glacial Gaze",
      "Eternal Frost",
      "Heavy Attack",
      "Detonate",
    ])
    expect(packed.preconditions).toEqual(
      expect.arrayContaining(["full-energy", "cutscene", "verify-forte"]),
    )
  })

  it("marks only the unproven cross-skill links as verify", () => {
    const packed = find(plan, "Glacial Gaze")
    // liberation → skill is proven; the heavy/forte hops are assumed.
    expect(packed.stages.map((st) => st.verify)).toEqual([
      false, // Glacial Gaze (clip start)
      false, // Eternal Frost (lib → skill, proven)
      true, // Heavy (skill → heavy, assumed)
      true, // Detonate (heavy → forte, assumed)
    ])
  })

  it("keeps the intro a swap-in singleton", () => {
    const intro = plan.find((s) => s.preconditions.includes("swap-in"))!
    expect(labels(intro)).toEqual(["Freezing Thorns"])
  })

  it("keeps the aerial mid-air a singleton airborne clip", () => {
    const air = plan.find((s) => s.preconditions.includes("airborne"))!
    expect(labels(air)).toEqual(["Mid-air Attack"])
    // Sanhua's mid-air declares `footing: { land }`, so no data gap.
    expect(air.stages[0].footingGap).toBe(false)
  })

  it("omits the zero-damage outro", () => {
    const all = plan.flatMap(labels)
    expect(all).not.toContain("Silversnow")
  })

  it("uses the first basic stage as the loop sentinel", () => {
    expect(plan[0].sentinel).toBe("Stage 1")
  })
})

describe("coverageOf", () => {
  const plan = planClips(sanhua)
  const chain = plan.find((s) => s.stages[0]?.label === "Stage 1")!

  const clipWith = (ids: string[]): Clip => ({
    id: "c",
    name: "",
    start: 0,
    end: 100,
    stageRefs: ids.map((id) => ({ id, skill: "", stage: "", hitCount: 0 })),
    boundaries: [],
    hits: [],
  })

  it("reads none, partial, then covered as stages get recorded", () => {
    expect(coverageOf(chain, [])).toBe("none")
    expect(coverageOf(chain, [clipWith([chain.stages[0].ref.id])])).toBe(
      "partial",
    )
    expect(
      coverageOf(chain, [clipWith(chain.stages.map((s) => s.ref.id))]),
    ).toBe("covered")
  })
})
