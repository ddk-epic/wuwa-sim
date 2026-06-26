import type { Element } from "#/data/elements"
import type { NegStatusType } from "#/data/neg-status-types"
import type { HitLabel } from "#/data/hit-labels"
import type { DamageEntry, SkillCategory, SkillType } from "./character"
import type { ScalarStatKey } from "./stat-table"

/**
 * Conjunction of narrowing axes that a HitContext must satisfy for an
 * `appliesToHits` buff to fold into that hit's stats. An absent axis is
 * unconstrained; an axis the hit lacks (e.g. `sourceBuffId` on an authored
 * hit) never matches a constrained filter.
 */
export interface HitFilter {
  sourceBuff?: string | string[]
  stage?: string | string[]
  stageId?: string | string[]
  skill?: string | string[]
  hitIndex?: number | number[]
  skillType?: SkillType | SkillType[]
  skillCategory?: SkillCategory | SkillCategory[]
  element?: Element | Element[]
  label?: HitLabel | HitLabel[]
}

/**
 * Per-hit identity box built at call sites (authored or synthetic) and
 * threaded through resolveStats/resolveHit. Fields absent on a given path
 * remain undefined.
 */
export interface HitContext {
  sourceBuffId?: string
  stageId?: string
  skill?: string
  /** 1-based (DamageEntry order). */
  hitIndex?: number
  skillType?: SkillType
  skillCategory?: SkillCategory
  element?: Element
  labels?: HitLabel[]
}

export type StatPath =
  | { stat: ScalarStatKey }
  | { stat: "elementBonus"; key: Element }
  | { stat: "skillTypeBonus"; key: SkillType }
  | { stat: "elementAmp"; key: Element }
  | { stat: "skillTypeAmp"; key: SkillType }
  | { stat: "shred"; key: SkillType }

export type ValueExpr =
  | { kind: "const"; v: number; snapshot?: boolean }
  | { kind: "perStack"; v: number; snapshot?: boolean }
  | {
      kind: "scaledByStat"
      stat: ScalarStatKey
      characterId: number
      per: number
      scale: number
      max: number
      /** Offset added to the stat value before computing (use 1.0 for ER/Pct stats that have an implicit 100% base). */
      base?: number
    }
  | {
      // `base + per × min(stacks_of(buff on characterId), max)`. With
      // `snapshot: true` the stack count is frozen at apply time.
      kind: "scaledByStacks"
      buff: string
      characterId: number
      per: number
      base: number
      max: number
      snapshot?: boolean
    }
  | {
      // `base + per × max(0, min(stacks_of_status, max) − threshold)`, read live
      // from the target's status stack count. Never frozen.
      kind: "fromStatusStacks"
      status: NegStatusType
      per: number
      base: number
      max: number
      threshold?: number
    }

export type ResourceKind = "energy" | "concerto" | "forte" | "pool"

export type StatEffect = {
  kind: "stat"
  path: StatPath
  value: ValueExpr
}

/**
 * Inject a synthetic hit attributed to the BuffInstance's source character.
 * `damage` carries multiplier (`value`), dmgType, energy, concerto. `icdFrames`
 * is the per-instance internal cooldown in frames (no default).
 */
export type EmitHitEffect = {
  kind: "emitHit"
  damage: DamageEntry
  icdFrames: number
  /** Skill type label used for triggers and log rendering. */
  skillType?: SkillType
  /** Element override; defaults to source character's element. */
  element?: Element
}

/**
 * Like `EmitHitEffect` but the resulting event is never re-entered into the
 * trigger matcher (the non-chain rule). Use for coordinated attack
 * reactions where coord→coord chaining must be impossible.
 */
export type CoordHitEffect = {
  kind: "coordHit"
  damage: DamageEntry
  icdFrames: number
  skillType?: SkillType
  element?: Element
}

export type ResourceEffect = {
  kind: "resource"
  resource: ResourceKind
  op: "add" | "sub" | "set"
  value: ValueExpr
  /** Defaults to the buff's target. */
  target?: "self" | "target" | "source"
}

export type RemoveBuffsEffect = {
  kind: "removeBuffs"
  buffs: string[]
}

/**
 * Mature held Deferred Emits in the source's Emit Pool now, oldest-first —
 * cancelling each member's pending maturation. `count: "all"` matures the whole
 * pool; convert on an empty pool is a no-op.
 */
export type ConvertEffect = {
  kind: "convert"
  count: number | "all"
}

export type NegStatusEffect = {
  kind: "negStatus"
  status: NegStatusType
  op: "apply" | "reduceBy" | "raiseToMax" | "raiseCap"
  n?: number
}

export type NegStatusModEffect = {
  kind: "negStatusMod"
  status: NegStatusType
  intervalMult: number
}

export type Effect =
  | StatEffect
  | ResourceEffect
  | EmitHitEffect
  | CoordHitEffect
  | RemoveBuffsEffect
  | ConvertEffect
  | NegStatusEffect
  | NegStatusModEffect

export type TriggerSource = "self" | "synthetic" | "any"

export type TriggerEvent =
  | { event: "simStart" }
  | {
      event: "skillCast"
      actor?: "self" | "any"
      characterId?: number
      skillCategory?: SkillCategory | SkillCategory[]
      stage?: string | string[]
      stageId?: string | string[]
      skill?: string | string[]
    }
  | {
      event: "hitLanded"
      actor?: "self" | "any"
      characterId?: number
      skillCategory?: SkillCategory | SkillCategory[]
      dmgType?: string
      source?: TriggerSource
      stage?: string | string[]
      sourceBuff?: string | string[]
      stageId?: string | string[]
      skill?: string | string[]
      hitIndex?: number | number[]
      /**
       * Fire only when the hit lands on a target that currently has this
       * negative status. Evaluated once at trigger time (the target's statuses
       * are stamped onto the event at dispatch), not continuously.
       */
      targetHasStatus?: NegStatusType
    }
  | {
      event: "swapIn"
      actor?: "self" | "any"
      characterId?: number
    }
  | {
      event: "swapOut"
      actor?: "self" | "any"
      characterId?: number
    }
  | {
      event: "healLanded"
      actor?: "self" | "any"
      characterId?: number
      skillCategory?: SkillCategory | SkillCategory[]
      stage?: string | string[]
      stageId?: string | string[]
      skill?: string | string[]
      hitIndex?: number | number[]
    }
  | {
      event: "resourceCrossed"
      resource: ResourceKind
      threshold: number
      direction: "up" | "down"
      actor?: "self" | "any"
      characterId?: number
    }
  | {
      // Fires on any net decrease of a resource, of any size —
      // threshold-free, unlike `resourceCrossed`. The faithful "on spend" hook.
      event: "resourceConsumed"
      resource: ResourceKind
      actor?: "self" | "any"
      characterId?: number
    }
  | {
      // Fires once per `step` of the resource crossed in `direction`. The
      // trigger index expands it to a threshold at every multiple of `step`.
      event: "resourceStep"
      resource: ResourceKind
      step: number
      direction: "consumed" | "gained"
      actor?: "self" | "any"
      characterId?: number
    }
  | {
      event: "negStatusInflicted"
      status?: NegStatusType
      actor?: "self" | "any"
      characterId?: number
    }

export type Trigger = TriggerEvent & {
  /**
   * Evaluated once when the trigger fires, before any cooldown is stamped; a
   * false result mints, stacks, and refreshes nothing. Reads relative to the
   * triggering event's acting character, not a live instance's reader — distinct
   * from the buff-root `condition`, which continuously gates contribution.
   */
  precondition?: Condition
}

export type BuffTarget =
  | {
      kind: "self"
      /**
       * FILTERS the self-target by wielder identity: the buff lands only when
       * the source character's id is listed. This is NOT a selector — a foreign
       * id yields no application and never redirects the buff to that character.
       * Absent = always lands on the source (today's behavior).
       */
      characterId?: number | number[]
    }
  | { kind: "nextOnField" }
  | { kind: "global" }

/** Sentinel `targetCharacterId` stamped on global (team-wide shared) instances. */
export const GLOBAL_TARGET_ID = 0

export type Condition =
  | {
      kind: "buffActive"
      buff: string
      on: "target" | "source"
      /** When true, the condition is satisfied while the buff is ABSENT. */
      negate?: boolean
    }
  | { kind: "onField" }
  | { kind: "actorIsOnField" }
  | { kind: "actorIsOffField" }
  | {
      kind: "resourceAtLeast"
      resource: ResourceKind
      n: number
      on: "target" | "source"
    }
  | {
      kind: "targetHasNegStatus"
      /** Narrow to a specific negative status. Absent = any negative status. */
      status?: NegStatusType
    }
  | {
      // Counts presence among the named buffs — one per active member, not stacks.
      kind: "buffCount"
      buffs: string[]
      op: "eq" | "gte"
      n: number
      on: "target" | "source"
    }

export interface ResourceState {
  energy: number
  concerto: number
  forte: number
  /** Emit Pool size — a projection of the pool store's member-list length. */
  pool: number
}

export function emptyResourceState(): ResourceState {
  return { energy: 0, concerto: 0, forte: 0, pool: 0 }
}

export type Duration =
  | { kind: "permanent" }
  | { kind: "frames"; v: number }
  | { kind: "seconds"; v: number }
  | { kind: "inherit"; buff: string }

export type StackingPolicy = {
  max: number
  onRetrigger:
    | "refresh"
    | "addStackRefresh"
    | "addStackKeep"
    | "addStackIndependent"
    | "ignore"
    | "replace"
}

export interface BuffDef {
  id: string
  name: string
  description?: string
  trigger: Trigger
  /**
   * Absent on reactions (reaction-shaped BuffDef). Both `target` and `duration`
   * must be either both present (stateful buff) or both absent (reaction).
   */
  target?: BuffTarget
  effects: Effect[]
  /**
   * Absent on reactions. Both `target` and `duration` must be either both
   * present (stateful buff) or both absent (reaction).
   */
  duration?: Duration
  /** Default `{ max: 1, onRetrigger: "refresh" }` when omitted. */
  stacking?: StackingPolicy
  /** Resonance chain sequence required (1..6). v1 only filters at bootstrap. */
  requiresSequence?: number
  /** Maximum sequence at which this buff is active (0 = base kit only). Opposite of requiresSequence. */
  maxSequence?: number
  /** Echo set piece count required (2, 3, or 5). v1 only filters at bootstrap. */
  requiresPieces?: 2 | 3 | 5
  /**
   * Typed and parsed by the engine but no enforcement: when multiple buffs
   * sharing the same group are simultaneously active, the engine emits a
   * console.info but applies all of them.
   */
  nonStackingGroup?: string
  /** Continuously evaluated; gates whether instance contributes effects. */
  condition?: Condition
  /** When true, instance is removed when its source character swaps out. */
  expiresOnSourceSwapOut?: boolean
  /**
   * When set, after each event is dispatched the engine walks active instances
   * and decrements stacks for those whose `consumedBy` filter matches the just-
   * fired event. When stacks reach 0 the instance is removed and a
   * `buffConsumed` lifecycle event is emitted.
   */
  consumedBy?: Trigger
  /**
   * When true, the dedupe key includes `sourceCharacterId` so two distinct
   * sources produce parallel instances on the same target. Default false:
   * re-application from any source refreshes the existing instance in place.
   */
  perSource?: boolean
  /** Minimum seconds between successive fires from the same source. Re-triggers within the window are suppressed. */
  cooldown?: number
  /**
   * When set, this buff's stat effects are excluded from the hit-agnostic
   * resolveStats pass and instead fold into a matching hit's snapshot via a
   * second sub-pass. The filter is a conjunction: every present
   * axis must match the HitContext; absent = unconstrained.
   */
  appliesToHits?: HitFilter
}

export interface BuffInstance {
  def: BuffDef
  /** Stable, monotonic identity stamped at creation; pairs lifecycle events by instance. */
  instanceId: number
  sourceCharacterId: number
  targetCharacterId: number
  endTime: number
  stacks: number
  /** Ascending per-stack expiries for `addStackIndependent`; FIFO drop-oldest at cap. */
  stackExpiries?: number[]
  appliedFrame: number
  /** Frozen values per effect index, populated when a ValueExpr has `snapshot: true`. */
  snapshots?: Record<number, number>
  /** True for global (team-wide shared) instances; every character reads this instance. */
  global?: true
}
