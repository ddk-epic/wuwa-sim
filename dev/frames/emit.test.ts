import { describe, expect, it } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import { patchCharacter } from "./emit"
import type { Clip, HitMark, StageRef } from "./types"

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

describe("patchCharacter", () => {
  it("patches actionTime from section width and actionFrame positionally", () => {
    const { patched } = patchCharacter(character(), baseClip())
    const a = stageOf(patched, "A")
    const b = stageOf(patched, "B")
    expect(a.actionTime).toBe(40)
    expect(b.actionTime).toBe(60)
    expect(a.damage?.map((d) => d.actionFrame)).toEqual([10, 25])
    expect(b.damage?.map((d) => d.actionFrame)).toEqual([30])
  })

  it("leaves the original registry object untouched", () => {
    const char = character()
    patchCharacter(char, baseClip())
    expect(stageOf(char, "A").actionTime).toBe(0)
  })

  it("resolves a cancel pinned to a hit, and a swap pinned to start", () => {
    const clip = baseClip({
      variants: {
        0: { cancel: { kind: "last" } },
        1: { swap: { kind: "start" } },
      },
    })
    const { patched } = patchCharacter(character(), clip)
    expect(stageOf(patched, "A").variants).toEqual({
      cancel: { actionTime: 25 },
    })
    expect(stageOf(patched, "B").variants).toEqual({ swap: { actionTime: 0 } })
  })

  it("a cancel pinned to start emits instantCancel and drops a stale cancel sibling", () => {
    const char = character()
    stageOf(char, "A").variants = { cancel: { actionTime: 99 } }
    const clip = baseClip({ variants: { 0: { cancel: { kind: "start" } } } })
    const { patched, changes } = patchCharacter(char, clip)
    expect(stageOf(patched, "A").variants).toEqual({
      instantCancel: { actionTime: 0 },
    })
    expect(changes.map((c) => c.path)).toContain("A.variants.cancel")
    expect(changes.map((c) => c.path)).toContain("A.variants.instantCancel")
  })

  it("warns and skips an unresolved variant rather than writing it", () => {
    const clip = baseClip({ variants: { 0: { swap: { kind: "hit", n: 5 } } } })
    const { patched, warnings } = patchCharacter(character(), clip)
    expect(stageOf(patched, "A").variants).toEqual({})
    expect(warnings.some((w) => w.includes("unresolved"))).toBe(true)
  })

  it("warns once and skips a stage the clip repeats", () => {
    const clip = baseClip({
      stageRefs: [ref("A", 2), ref("A", 2)],
      hits: [hit("a0", 10, 0), hit("a1", 50, 1)],
    })
    const { patched, warnings, changes } = patchCharacter(character(), clip)
    expect(stageOf(patched, "A").actionTime).toBe(0)
    expect(changes).toHaveLength(0)
    expect(warnings.filter((w) => w.includes("more than once"))).toHaveLength(1)
  })

  it("emits faithful JSON and a TS literal with unquoted keys and the wrapper", () => {
    const { json, ts } = patchCharacter(character(), baseClip())
    expect(JSON.parse(json).skills[0].stages[0].actionTime).toBe(40)
    expect(ts).toContain(
      'import type { EnrichedCharacter } from "#/types/character"',
    )
    expect(ts).toContain("export const testChar = {")
    expect(ts).toContain("satisfies EnrichedCharacter")
    expect(ts).toContain("actionTime: 40,")
    expect(ts).not.toContain('"actionTime"')
  })
})
