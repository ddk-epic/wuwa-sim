import { describe, expect, it } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import { buildExport } from "./export"
import { reconcile } from "./reconcile"
import type { Clip, HitMark, StageRef } from "./types"

// Most cases export from a single clip; its reconciliation is that clip alone.
const run = (char: EnrichedCharacter, clip: Clip) =>
  buildExport(char, clip, reconcile([clip]))

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

const entry = () => ({ actionFrame: 0, value: 1 })

// A two-stage character: A (2 hits) then B (1 hit). `variants` is given to A and
// omitted from B, matching the registry's mix of `{}` and absent.
function character(): EnrichedCharacter {
  return {
    name: "Test Char",
    skills: [
      {
        name: "skill",
        stages: [
          {
            name: "A",
            actionTime: 0,
            variants: {},
            damage: [entry(), entry()],
          },
          { name: "B", actionTime: 0, damage: [entry()] },
        ],
      },
    ],
  } as unknown as EnrichedCharacter
}

// A→B split at frame 40 over [0,100]; A owns hits at 10/25, B owns one at 70.
function baseClip(over: Partial<Clip> = {}): Clip {
  return {
    id: "c1",
    name: "",
    start: 0,
    end: 100,
    stageRefs: [ref("A", 2), ref("B", 1)],
    boundaries: [{ id: "b0", frame: 40, cue: "animationBreak" }],
    hits: [hit("a0", 10, 0), hit("a1", 25, 0), hit("b0", 70, 1)],
    ...over,
  }
}

const stageOf = (char: EnrichedCharacter, name: string) =>
  char.skills[0].stages.find((s) => s.name === name)!

describe("buildExport", () => {
  it("patches actionTime from section width and actionFrame positionally", () => {
    const { patched } = run(character(), baseClip())
    const a = stageOf(patched, "A")
    const b = stageOf(patched, "B")
    expect(a.actionTime).toBe(40)
    expect(b.actionTime).toBe(60)
    expect(a.damage?.map((d) => d.actionFrame)).toEqual([10, 25])
    expect(b.damage?.map((d) => d.actionFrame)).toEqual([30])
  })

  it("leaves the original registry object untouched", () => {
    const char = character()
    run(char, baseClip())
    expect(stageOf(char, "A").actionTime).toBe(0)
  })

  it("resolves a cancel pinned to a hit, and a swap pinned to start", () => {
    const clip = baseClip({
      variants: {
        0: { cancel: { kind: "last" } },
        1: { swap: { kind: "start" } },
      },
    })
    const { patched } = run(character(), clip)
    expect(stageOf(patched, "A").variants).toEqual({
      cancel: { actionTime: 25 },
    })
    expect(stageOf(patched, "B").variants).toEqual({ swap: { actionTime: 0 } })
  })

  it("a cancel pinned to start produces instantCancel and drops a stale cancel sibling", () => {
    const char = character()
    stageOf(char, "A").variants = { cancel: { actionTime: 99 } }
    const clip = baseClip({ variants: { 0: { cancel: { kind: "start" } } } })
    const { patched, changes } = run(char, clip)
    expect(stageOf(patched, "A").variants).toEqual({
      instantCancel: { actionTime: 0 },
    })
    expect(changes.map((c) => c.path)).toContain("A.variants.cancel")
    expect(changes.map((c) => c.path)).toContain("A.variants.instantCancel")
  })

  it("warns and skips an unresolved variant rather than writing it", () => {
    const clip = baseClip({ variants: { 0: { swap: { kind: "hit", n: 5 } } } })
    const { patched, warnings } = run(character(), clip)
    expect(stageOf(patched, "A").variants).toEqual({})
    expect(warnings.some((w) => w.includes("unresolved"))).toBe(true)
  })

  it("warns once and skips a stage the clip repeats", () => {
    const clip = baseClip({
      stageRefs: [ref("A", 2), ref("A", 2)],
      hits: [hit("a0", 10, 0), hit("a1", 50, 1)],
    })
    const { patched, warnings, changes } = run(character(), clip)
    expect(stageOf(patched, "A").actionTime).toBe(0)
    expect(changes).toHaveLength(0)
    expect(warnings.filter((w) => w.includes("more than once"))).toHaveLength(1)
  })

  it("writes animationFrames from a split, rebases actionTime, and zeroes split-stage hit frames", () => {
    const clip = baseClip({
      animationSplits: [{ frame: 12, cue: "vfxEdge" }, null],
    })
    const { patched, changes } = run(character(), clip)
    const a = stageOf(patched, "A")
    expect(a.animationFrames).toBe(12)
    expect(a.actionTime).toBe(28)
    expect(a.damage?.map((d) => d.actionFrame)).toEqual([0, 0])
    expect(changes.map((c) => c.path)).toContain("A.animationFrames")
    // B has no split — unchanged behaviour, no animationFrames written.
    const b = stageOf(patched, "B")
    expect(b.animationFrames).toBeUndefined()
    expect(b.actionTime).toBe(60)
    expect(b.damage?.map((d) => d.actionFrame)).toEqual([30])
  })

  it("produces a TS literal with unquoted keys and the wrapper", () => {
    const { ts } = run(character(), baseClip())
    expect(ts).toContain(
      'import type { EnrichedCharacter } from "#/types/character"',
    )
    expect(ts).toContain("export const testChar = {")
    expect(ts).toContain("satisfies EnrichedCharacter")
    expect(ts).toContain("actionTime: 40,")
    expect(ts).not.toContain('"actionTime"')
  })

  it("keeps small objects inline, breaking only what overflows the width", () => {
    const { ts } = run(character(), baseClip())
    // A short damage entry fits on one line; the whole character does not.
    expect(ts).toContain("{ actionFrame: 10, value: 1 }")
    expect(ts).toMatch(/export const testChar = \{\n/)
  })

  it("skips a conflicting stage's actionTime and warns instead", () => {
    const clip = baseClip()
    // A second clip disagrees on A's length (40 vs 30) at the same trust.
    const other = baseClip({
      id: "c2",
      boundaries: [{ id: "b0", frame: 30, cue: "animationBreak" }],
      hits: [],
    })
    const { patched, warnings, changes } = buildExport(
      character(),
      clip,
      reconcile([clip, other]),
    )
    expect(stageOf(patched, "A").actionTime).toBe(0)
    expect(changes.map((c) => c.path)).not.toContain("A.actionTime")
    expect(warnings.some((w) => w.includes("disagree"))).toBe(true)
    // Hits still commit — they're a separate axis from the timing conflict.
    expect(stageOf(patched, "A").damage?.map((d) => d.actionFrame)).toEqual([
      10, 25,
    ])
  })
})
