import type { SimulationLogEntry, ActiveBuff } from "#/types/simulation-log"
import type { SkillType } from "#/types/character"

export const FPS = 60
/** Floor on rendered buff lanes per character; not a cap (lanes may exceed it). */
export const TL_BUFF_LANES = 5
const MIN_BLOCK_S = 0.25

/** How many lanes a skill type's block spans on the action lane. */
const LANE_SPAN_BY_SKILL_TYPE: [SkillType, 1 | 2][] = [
  ["Resonance Liberation", 2],
  ["Outro Skill", 2],
]
const laneSpanOf = (skillType: SkillType): 1 | 2 =>
  LANE_SPAN_BY_SKILL_TYPE.find(([type]) => type === skillType)?.[1] ?? 1

export type ActionBlock = {
  charId: number
  skillName: string
  skillType: SkillType
  start: number
  end: number
  laneSpan: 1 | 2
}
export type Buff = {
  id: string
  charId: number
  buffName: string
  sourceCharacterId: number
  startTime: number
  /** real expiry, or Infinity if the buff never expires */
  endTime: number
  lane: number
}

/** Id/number-only derivation of the buff timeline. Carries no character visuals. */
export interface BuffTimelineModel {
  charIds: number[]
  actionBlocks: ActionBlock[]
  buffs: Buff[]
  passivesByChar: Map<number, ActiveBuff[]>
  axisMax: number
  restStart: number
}

export function buildBuffTimelineModel(
  log: SimulationLogEntry[],
  rosterIds: number[] = [],
): BuffTimelineModel {
  const charIds: number[] = []
  const seen = new Set<number>()
  const note = (id: number | undefined) => {
    if (id == null || seen.has(id)) return
    seen.add(id)
    charIds.push(id)
  }
  for (const id of rosterIds) note(id)
  for (const e of log) {
    if (e.kind === "buffApplied" || e.kind === "buffRefreshed")
      note(e.targetCharacterId)
    else if ("characterId" in e) note(e.characterId)
  }

  const lastHitFrameByEntry = new Map<string, number>()
  for (const e of log) {
    if (e.kind !== "hit" || e.synthetic || !e.sourceEntryId) continue
    const cur = lastHitFrameByEntry.get(e.sourceEntryId) ?? 0
    if (e.frame > cur) lastHitFrameByEntry.set(e.sourceEntryId, e.frame)
  }

  const actions = log
    .filter(
      (e): e is Extract<SimulationLogEntry, { kind: "action" }> =>
        e.kind === "action",
    )
    .sort((a, b) => a.frame - b.frame)
  const actionBlocks: ActionBlock[] = actions.map((a, i) => {
    const start = a.frame / FPS
    const isLast = i === actions.length - 1
    const hitEndTime =
      a.sourceEntryId != null && lastHitFrameByEntry.has(a.sourceEntryId)
        ? lastHitFrameByEntry.get(a.sourceEntryId)! / FPS
        : start + MIN_BLOCK_S
    const end = isLast
      ? Math.max(start + MIN_BLOCK_S, hitEndTime)
      : actions[i + 1].frame / FPS
    return {
      charId: a.characterId,
      skillName: a.skillName,
      skillType: a.skillType,
      start,
      end,
      laneSpan: laneSpanOf(a.skillType),
    }
  })

  const restStart = actionBlocks.reduce((mx, c) => Math.max(mx, c.end), 0)
  let axisMax = Math.max(10, Math.ceil(restStart / 5) * 5)
  if (axisMax - restStart < 1) axisMax += 5

  // Passive buffs are folded at bootstrap and never change
  const passivesByChar = new Map<number, ActiveBuff[]>()
  for (const e of log) {
    if (e.kind !== "hit" && e.kind !== "sustain") continue
    if (!passivesByChar.has(e.characterId))
      passivesByChar.set(e.characterId, e.passiveBuffs)
  }

  type PendingBuffStart = {
    startTime: number
    sourceCharacterId: number
    buffName: string
  }
  const pendingBuffStarts = new Map<string, PendingBuffStart>()
  type BuffInterval = Omit<Buff, "lane">
  const intervals: BuffInterval[] = []
  let intervalSeq = 0
  for (const e of log) {
    if (
      e.kind !== "buffApplied" &&
      e.kind !== "buffRefreshed" &&
      e.kind !== "buffExpired" &&
      e.kind !== "buffConsumed"
    )
      continue
    const key = `${e.buffId}:${e.targetCharacterId}`
    const time = e.frame / FPS
    if (e.kind === "buffApplied" || e.kind === "buffRefreshed") {
      if (!pendingBuffStarts.has(key))
        pendingBuffStarts.set(key, {
          startTime: time,
          sourceCharacterId: e.sourceCharacterId,
          buffName: e.buffName,
        })
    } else {
      const pending = pendingBuffStarts.get(key)
      if (!pending) continue
      intervals.push({
        id: `b${intervalSeq++}`,
        charId: e.targetCharacterId,
        buffName: e.buffName,
        sourceCharacterId: pending.sourceCharacterId,
        startTime: pending.startTime,
        endTime: time,
      })
      pendingBuffStarts.delete(key)
    }
  }
  // never expired → permanent
  for (const [key, pending] of pendingBuffStarts) {
    const target = key.slice(key.lastIndexOf(":") + 1)
    intervals.push({
      id: `b${intervalSeq++}`,
      charId: Number(target),
      buffName: pending.buffName,
      sourceCharacterId: pending.sourceCharacterId,
      startTime: pending.startTime,
      endTime: Infinity,
    })
  }

  // greedy lane packing per character (overlaps spill into new, unbounded lanes)
  const buffs: Buff[] = []
  for (const id of charIds) {
    const charBuffs = intervals
      .filter((b) => b.charId === id)
      .sort((a, b) => a.startTime - b.startTime)
    const laneEnds: number[] = []
    for (const b of charBuffs) {
      let lane = laneEnds.findIndex((end) => end <= b.startTime)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(b.endTime)
      } else {
        laneEnds[lane] = b.endTime
      }
      buffs.push({ ...b, lane })
    }
  }

  return { charIds, actionBlocks, buffs, passivesByChar, axisMax, restStart }
}
