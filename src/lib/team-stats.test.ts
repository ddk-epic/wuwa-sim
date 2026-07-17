// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { SkillType } from "#/types/character"
import type {
  ActionEvent,
  HitEvent,
  SimulationLogEntry,
  SustainEvent,
} from "#/types/simulation-log"
import { emptyStatTable } from "#/types/stat-table"
import { computeTeamStats } from "./team-stats"

/**
 * A minimal HitEvent fixture — only the fields `computeTeamStats` reads carry
 * meaning; the rest are filled to satisfy the type.
 */
function hit(
  characterId: number,
  skillType: SkillType,
  damage: number,
  cumulativeEnergy = 0,
  cumulativeConcerto = 0,
): HitEvent {
  return {
    kind: "hit",
    characterId,
    skillType,
    skillName: `${skillType} hit`,
    frame: 0,
    cumulativeEnergy,
    cumulativeConcerto,
    cumulativeForte: 0,
    damage,
    element: "Fusion",
    dmgType: "Fusion",
    multiplier: 1,
    statsSnapshot: emptyStatTable(),
    activeBuffs: [],
    passiveBuffs: [],
  }
}

function heal(characterId: number, amount: number): SustainEvent {
  return {
    kind: "sustain",
    sub: "heal",
    characterId,
    skillType: "Resonance Skill",
    skillName: "heal",
    frame: 0,
    cumulativeEnergy: 999,
    cumulativeConcerto: 999,
    cumulativeForte: 0,
    amount,
    targets: [characterId],
    multiplier: 1,
    statsSnapshot: emptyStatTable(),
    activeBuffs: [],
    passiveBuffs: [],
  }
}

function action(characterId: number): ActionEvent {
  return {
    kind: "action",
    characterId,
    skillType: "Basic Attack",
    skillCategory: "Basic Attack",
    skillName: "action",
    frame: 0,
    cumulativeEnergy: 0,
    cumulativeConcerto: 0,
    cumulativeForte: 0,
  }
}

describe("computeTeamStats", () => {
  it("sums damage per characterId in dmgByChar", () => {
    const log: SimulationLogEntry[] = [
      hit(1, "Basic Attack", 100),
      hit(1, "Heavy Attack", 250),
      hit(2, "Resonance Skill", 400),
    ]
    const stats = computeTeamStats(log)
    expect(stats.dmgByChar).toEqual({ 1: 350, 2: 400 })
  })

  it("groups { count, dmg } per skillType in typeMix", () => {
    const log: SimulationLogEntry[] = [
      hit(1, "Basic Attack", 100),
      hit(2, "Basic Attack", 50),
      hit(1, "Resonance Skill", 400),
    ]
    const stats = computeTeamStats(log)
    expect(stats.typeMix).toEqual({
      "Basic Attack": { count: 2, dmg: 150 },
      "Resonance Skill": { count: 1, dmg: 400 },
    })
  })

  it("reads concerto/energy end from the last hit", () => {
    const log: SimulationLogEntry[] = [
      hit(1, "Basic Attack", 100, 10, 5),
      hit(1, "Heavy Attack", 250, 42, 17),
    ]
    const stats = computeTeamStats(log)
    expect(stats.resEnd).toBe(42)
    expect(stats.concertoEnd).toBe(17)
  })

  it("ignores non-hit events (sustains, actions) for damage and type mix", () => {
    const log: SimulationLogEntry[] = [
      action(1),
      hit(1, "Basic Attack", 100, 10, 5),
      heal(2, 9999),
    ]
    const stats = computeTeamStats(log)
    expect(stats.dmgByChar).toEqual({ 1: 100 })
    expect(stats.typeMix).toEqual({ "Basic Attack": { count: 1, dmg: 100 } })
    // The trailing heal's cumulative values (999) must NOT leak into the ends.
    expect(stats.resEnd).toBe(10)
    expect(stats.concertoEnd).toBe(5)
  })

  it("includes synthetic hits (they deal damage attributed to a character)", () => {
    const synthetic: HitEvent = {
      ...hit(1, "Basic Attack", 80),
      synthetic: true,
      sourceBuffId: "some.buff",
    }
    const stats = computeTeamStats([hit(1, "Basic Attack", 20), synthetic])
    expect(stats.dmgByChar).toEqual({ 1: 100 })
    expect(stats.typeMix["Basic Attack"]).toEqual({ count: 2, dmg: 100 })
  })
})
