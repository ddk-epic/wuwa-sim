// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import { snapshotMarkdown } from "./snapshot"
import { projectStages } from "./projection"
import { reconcile } from "./reconcile"
import type { Clip, HitMark } from "./clip"
import type { StageRef } from "./stage-ref"

const snapshotOf = (char: EnrichedCharacter, clips: Clip[]) =>
  snapshotMarkdown(char, projectStages(clips, reconcile(clips)))

const ref = (name: string, hitCount: number): StageRef => ({
  id: `skill::${name}`,
  skill: "skill",
  stage: name,
  hitCount,
})

const hit = (id: string, frame: number, owner: number): HitMark => ({
  id,
  frame,
  cue: "impactFlash",
  owner,
})

// A (2 hits), B (1 hit), and C (1 hit) — C is in the catalog but absent from the clip.
const char = {
  name: "Test Char",
  skills: [
    {
      name: "skill",
      type: "Resonance Skill",
      stages: [
        { name: "A", actionTime: 0, damage: [{}, {}] },
        { name: "B", actionTime: 0, damage: [{}] },
        { name: "C", actionTime: 0, damage: [{}] },
      ],
    },
  ],
} as unknown as EnrichedCharacter

// A over [0,40] with one of two hits placed; B over [40,100] with none.
const clip: Clip = {
  id: "c1",
  name: "Combo",
  start: 0,
  end: 100,
  stageRefs: [ref("A", 2), ref("B", 1)],
  boundaries: [{ id: "b0", frame: 40, cue: "animationBreak" }],
  hits: [hit("a0", 10, 0)],
  variants: { 0: { cancel: { kind: "last" } }, 1: { swap: { kind: "start" } } },
}

describe("snapshotMarkdown", () => {
  const md = snapshotOf(char, [clip])

  it("carries actionTime and resolved variants on each stage line", () => {
    expect(md).toContain("**A** — actionTime `40` · cancel `10` · swap `—`")
    expect(md).toContain("**B** — actionTime `60` · cancel `—` · swap `0`")
  })

  it("lists every hit slot, with an em-dash for the unmeasured ones", () => {
    expect(md).toContain("| 1 | 10 | impactFlash |")
    expect(md).toContain("| 2 | — | — |")
  })

  it("renders a stage absent from every clip as all em-dash", () => {
    expect(md).toContain("**C** — actionTime `—` · cancel `—` · swap `—`")
  })
})
