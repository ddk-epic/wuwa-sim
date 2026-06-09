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
  skillCategory: "Basic Attack",
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
  instanceId = 0,
): SimulationLogEntry => ({
  kind: "buffApplied",
  instanceId,
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
  instanceId = 0,
): SimulationLogEntry => ({
  kind: "buffExpired",
  instanceId,
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
      log.push(applied(`b.${i}`, 1, 0, 99, `b.${i}`, i))
      log.push(expired(`b.${i}`, 1, 60, `b.${i}`, i))
    }
    const m = buildBuffTimelineModel(log, [1])
    const lanes = m.buffs.map((b) => b.lane).sort((a, b) => a - b)
    expect(lanes).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(Math.max(...lanes)).toBeGreaterThanOrEqual(TL_BUFF_LANES)
  })

  it("reuses a lane once the prior buff has ended", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.a", 1, 0, 99, "b.a", 0),
      expired("b.a", 1, 60, "b.a", 0),
      applied("b.b", 1, 120, 99, "b.b", 1),
      expired("b.b", 1, 180, "b.b", 1),
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

  it("lane height keys on skillCategory, not the damage type (skillType)", () => {
    // A liberation whose damage[0].type collapsed to Basic Attack: category drives height.
    const log: SimulationLogEntry[] = [
      action({
        characterId: 1,
        frame: 0,
        skillCategory: "Resonance Liberation",
        skillType: "Basic Attack",
      }),
      action({
        characterId: 1,
        frame: 60,
        skillCategory: "Basic Attack",
        skillType: "Resonance Liberation",
      }),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.actionBlocks[0].laneSpan).toBe(2)
    expect(m.actionBlocks[1].laneSpan).toBe(1)
  })

  it("Outro Skill category spans 2 lanes", () => {
    const m = buildBuffTimelineModel(
      [action({ characterId: 1, frame: 0, skillCategory: "Outro Skill" })],
      [1],
    )
    expect(m.actionBlocks[0].laneSpan).toBe(2)
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

describe("buildBuffTimelineModel — interval pairing by instanceId (#340)", () => {
  it("perSource: two instances of one buffId on the same target → two untruncated bars", () => {
    // A live [0s,5s] from source 1, B live [3s,8s] from source 2 — same buffId+target.
    // Old buffId:target keying collapsed these into one truncated bar.
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.shared", 9, 0, 1, "Shared", 0),
      applied("b.shared", 9, 180, 2, "Shared", 1),
      expired("b.shared", 9, 300, "Shared", 0),
      expired("b.shared", 9, 480, "Shared", 1),
    ]
    const m = buildBuffTimelineModel(log, [9])
    const bars = m.buffs
      .filter((b) => b.buffName === "Shared")
      .sort((a, b) => a.startTime - b.startTime)
    expect(bars).toHaveLength(2)
    expect(bars[0]).toMatchObject({
      startTime: 0,
      endTime: 5,
      sourceCharacterId: 1,
    })
    expect(bars[1]).toMatchObject({
      startTime: 3,
      endTime: 8,
      sourceCharacterId: 2,
    })
  })

  it("apply → expire → apply on the same identity → two separate bars", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.x", 1, 0, 99, "b.x", 0),
      expired("b.x", 1, 60, "b.x", 0),
      applied("b.x", 1, 120, 99, "b.x", 1),
      expired("b.x", 1, 180, "b.x", 1),
    ]
    const m = buildBuffTimelineModel(log, [1])
    const bars = m.buffs.sort((a, b) => a.startTime - b.startTime)
    expect(bars).toHaveLength(2)
    expect(bars[0]).toMatchObject({ startTime: 0, endTime: 1 })
    expect(bars[1]).toMatchObject({ startTime: 2, endTime: 3 })
  })

  it("never-expired instance → single Infinity bar", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.perm", 1, 0, 99, "b.perm", 7),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.buffs).toHaveLength(1)
    expect(m.buffs[0].endTime).toBe(Infinity)
  })

  it("refresh keeps the original source/start, extends the same bar", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      applied("b.r", 1, 0, 5, "b.r", 0),
      // refresh from a different source must not start a new bar nor overwrite source
      {
        kind: "buffRefreshed",
        instanceId: 0,
        buffId: "b.r",
        buffName: "b.r",
        sourceCharacterId: 8,
        targetCharacterId: 1,
        frame: 30,
        stacks: 1,
      },
      expired("b.r", 1, 90, "b.r", 0),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.buffs).toHaveLength(1)
    expect(m.buffs[0]).toMatchObject({
      startTime: 0,
      endTime: 1.5,
      sourceCharacterId: 5,
    })
  })

  it("terminal-only group (terminal with no start) → dropped", () => {
    const log: SimulationLogEntry[] = [
      action({ characterId: 1, frame: 0 }),
      expired("b.seeded", 1, 60, "b.seeded", 0),
    ]
    const m = buildBuffTimelineModel(log, [1])
    expect(m.buffs).toEqual([])
  })
})
