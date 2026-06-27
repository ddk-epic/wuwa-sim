import type { Element } from "#/data/elements"
import type { StatTable } from "./stat-table"
import type { SkillType, SkillCategory, VariantKind } from "./character"

interface SimulationLogBase {
  characterId: number
  skillType: SkillType
  skillName: string
  frame: number
  cumulativeEnergy: number
  cumulativeConcerto: number
}

/**
 * Padding Delay breakdown. `pad` holds the action-cost components forming the
 * "+0.Xs" suffix beside the skill: `reaction`/`floor` are mutually exclusive (see
 * stage.ts), `trailing`/`fall` add on top. `wait` is the idle frames before the
 * action can begin (the wait badge) — `max(swap-back cooldown, prior-stage gate,
 * skill cooldown)`, a single number since the floors are never surfaced apart.
 */
export interface DelayBreakdown {
  pad: {
    reaction: number
    floor: number
    trailing: number
    fall: number
  }
  wait: number
}

/**
 * An engine-emitted warning about an executed action — the action proceeded,
 * but the simulation observed something a real play could not do (impossible
 * entry footing) or would not allow (casting below a resource cost). Carried on
 * the action's ActionEvent and surfaced on its timeline row. Stores the data
 * each finding needs; the wording lives in the row-messages catalog.
 */
export type DiagnosticKind =
  | { kind: "footingViolation"; isLand: boolean }
  | { kind: "insufficientEnergy"; actor: string; energy: number; cost: number }
  | {
      kind: "insufficientConcerto"
      actor: string
      concerto: number
      required: number
    }
  | {
      kind: "insufficientOutroConcerto"
      actor: string
      concerto: number
      cost: number
    }
  | { kind: "skillOnCooldown"; actor: string; remaining: number }

/**
 * `severity` defaults to `"warning"` at the render boundary (existing findings
 * stay yellow); `"invalid"` routes the diagnostic into the row's error channel
 * and styles it red.
 */
export type Diagnostic = DiagnosticKind & {
  severity?: "invalid" | "warning"
}

export interface ActionEvent extends SimulationLogBase {
  kind: "action"
  /** Trigger axis (player input) for this action; orthogonal to `skillType`. */
  skillCategory: SkillCategory
  /** Actor's Emit Pool size at this action; omitted when zero. */
  pool?: number
  variantKind?: VariantKind
  delayBreakdown?: DelayBreakdown
  diagnostics?: Diagnostic[]
  sourceEntryId?: string
}

export interface ActiveBuff {
  id: string
  name: string
  stacks: number
  sourceCharacterId?: number
}

export interface HitEvent extends SimulationLogBase {
  kind: "hit"
  damage: number
  element: Element
  dmgType: string
  scalingStat?: string
  multiplier: number
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
  /** True when the hit was injected by an `emitHit` effect rather than authored. */
  synthetic?: boolean
  /** When `synthetic` is true, the BuffDef.id that emitted the hit. */
  sourceBuffId?: string
  /** The TimelineEntry.id whose stage produced this hit (authored or synthetic). */
  sourceEntryId?: string
  /** True when emitted by a `coordHit` effect (coordinated attack). */
  coord?: true
}

export interface SustainEvent extends SimulationLogBase {
  kind: "sustain"
  sub: "heal" | "shield"
  amount: number
  targets: number[]
  scalingStat?: string
  multiplier: number
  flat?: number
  statsSnapshot: StatTable
  activeBuffs: ActiveBuff[]
  passiveBuffs: ActiveBuff[]
  synthetic?: boolean
  sourceBuffId?: string
  sourceEntryId?: string
  coord?: true
}

export interface BuffEvent {
  kind:
    | "buffApplied"
    | "buffRefreshed"
    | "buffStacksChanged"
    | "buffExpired"
    | "buffConsumed"
  /** Identity of the Buff Instance this event belongs to (stamped at creation). */
  instanceId: number
  buffId: string
  buffName: string
  sourceCharacterId: number
  targetCharacterId: number
  frame: number
  stacks: number
}

export type SimulationLogEntry =
  | ActionEvent
  | HitEvent
  | SustainEvent
  | BuffEvent

export type LogVariant = "table" | "timeline"
