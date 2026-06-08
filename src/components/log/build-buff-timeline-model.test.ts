import { describe, expect, it } from "vitest"
import type { SimulationLogEntry } from "#/types/simulation-log"
import {
  buildBuffTimelineModel,
  FPS,
  TL_BUFF_LANES,
} from "./build-buff-timeline-model"

const action = (
  over: Partial<Extract<SimulationLogEntry, { kind: "action" }>> &
    Pick<
      Extract<SimulationLogEntry, { kind: "action" }>,
      "characterId" | "frame"
    >,
): SimulationLogEntry => ({
  kind: "action",
  skillType: "Basic Attack",
  skillName: "Attack",
  cumulativeEnergy: 0,
  cumulativeConcerto: 0,
  ...over,
})

const applied = (
  buffId: string,
  target: number,
  frame: number,
  source = 99,
  buffName = buffId,
): SimulationLogEntry => ({
  kind: "buffApplied",
  buffId,
  buffName,
  sourceCharacterId: source,
  targetCharacterId: target,
  frame,
  stacks: 1,
})

const expired = (
  buffId: string,
  target: number,
  frame: number,
  buffName = buffId,
): SimulationLogEntry => ({
  kind: "buffExpired",
  buffId,
  buffName,
  sourceCharacterId: 99,
  targetCharacterId: target,
  frame,
  stacks: 1,
})

describe("buildBuffTimelineModel", () => {
  it("empty log → empty roster, default axis", () => {
    const m = buildBuffTimelineModel([], [])
    expect(m.charIds).toEqual([])
    expect(m.axisMax).toBe(10)
    expect(m.restStart).toBe(0)
    expect(m.buffs).toEqual([])
    expect(m.actionBlocks).toEqual([])
  })

  it("is id/number-only — buffs carry sourceCharacterId, not a name", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.x", 1, 0, 7),
      expired("b.x", 1, 60),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.charIds).toEqual([1])
    const b = m.buffs[0]
    expect(b.sourceCharacterId).toBe(7)
    expect(b).not.toHaveProperty("sourceName")
  })

  it("packs concurrent buffs into lanes 0,1,2,… with no wrap past TL_BUFF_LANES", () => {
    // 7 buffs all live at once on char 1 — must occupy lanes 0..6, never wrapping.
    const log: SimulationLogEntry[] = [action({ characterId: 1, frame: 0 })]
    const N = 7
    for (let i = 0; i < N; i++) {
      log.push(applied(`b.${i}`, 1, 0))
      log.push(expired(`b.${i}`, 1, 60))
    }
    const m = buildBuffTimelineModel(log, [1])
    const lanes = m.buffs.map((b) => b.lane).sort((a, b) => a - b)
    expect(lanes).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(Math.max(...lanes)).toBeGreaterThanOrEqual(TL_BUFF_LANES)
  })

  it("reuses a lane once the prior buff has ended", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.a", 1, 0),
      expired("b.a", 1, 60),
      applied("b.b", 1, 120),
      expired("b.b", 1, 180),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.buffs.every((b) => b.lane === 0)).toBe(true)
  })

  it("never-expired buff → endTime Infinity", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.perm", 1, 0),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.buffs[0].endTime).toBe(Infinity)
  })

  it("axisMax rounds up to a multiple of 5 and bumps +5 when within 1s of rest", () => {
    // last action at 8.4s (504 frames); restStart ~8.4 → ceil(8.4/5)*5 = 10, gap 1.6 ≥ 1 → 10
    const a = buildBuffTimelineModel(
      [
        action({ characterId: 1, frame: 0 }),
        action({ characterId: 1, frame: 504 }),
      ],
      [1],
    )
    expect(a.axisMax).toBe(10)

    // last action at 9.5s (570 frames) → restStart 9.75; ceil(9.75/5)*5 = 10, gap 0.25 < 1 → +5 = 15
    const b = buildBuffTimelineModel(
      [
        action({ characterId: 1, frame: 0 }),
        action({ characterId: 1, frame: 570 }),
      ],
      [1],
    )
    expect(b.restStart).toBeCloseTo(570 / FPS + 0.25, 5)
    expect(b.axisMax).toBe(15)
  })

  it("orders roster first, then buff-target-only chars encountered in the log", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 2, frame: 0 }),
      applied("b.x", 5, 0), // char 5 only ever appears as a buff target
      expired("b.x", 5, 60),
    ]
    const m = buildBuffTimelineModel(log, [2, 3])
    expect(m.charIds).toEqual([2, 3, 5])
  })

  it("same-frame action yields a zero-width block (frozen: end === start)", () => {
    // two actions on the same frame; the first's end is the next action's frame → equal
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 120 }),
      action({ characterId: 2, frame: 120 }),
    ]
    const m = buildBuffTimelineModel(log, [1, 2])
    expect(m.actionBlocks[0].end).toBe(m.actionBlocks[0].start)
  })
})
