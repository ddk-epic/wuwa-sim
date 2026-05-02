export type StatPath =
  | {
      stat:
        | "atkBase"
        | "atkPct"
        | "atkFlat"
        | "critRate"
        | "critDmg"
        | "defShred"
    }
  | { stat: "elementBonus"; key: string }
  | { stat: "skillTypeBonus"; key: string }
  | { stat: "deepen"; key: string }
  | { stat: "resShred"; key: string }

export type ValueExpr = { kind: "const"; v: number; snapshot?: boolean }

export type ResourceKind = "energy" | "concerto" | "forte" | "resonance"

export type StatEffect = {
  kind: "stat"
  path: StatPath
  value: ValueExpr
}

export type ResourceEffect = {
  kind: "resource"
  resource: ResourceKind
  op: "add" | "sub" | "set"
  value: ValueExpr
  /** Defaults to the buff's target. */
  target?: "self" | "target" | "source"
}

export type Effect = StatEffect | ResourceEffect

export type TriggerSource = "self" | "synthetic" | "any"

export type Trigger =
  | { event: "simStart" }
  | {
      event: "skillCast"
      actor?: "self" | "any"
      characterId?: number
      skillType?: string
    }
  | {
      event: "hitLanded"
      actor?: "self" | "any"
      characterId?: number
      skillType?: string
      dmgType?: string
      source?: TriggerSource
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
      event: "resourceCrossed"
      resource: ResourceKind
      threshold: number
      direction: "up" | "down"
      actor?: "self" | "any"
      characterId?: number
    }

export type BuffTarget =
  | { kind: "self" }
  | { kind: "team" }
  | { kind: "nextOnField" }

export type Condition =
  | { kind: "buffActive"; buffId: string; on: "target" | "source" }
  | { kind: "onField" }
  | { kind: "actorIsOnField" }
  | {
      kind: "resourceAtLeast"
      resource: ResourceKind
      n: number
      on: "target" | "source"
    }

export interface ResourceState {
  energy: number
  concerto: number
  forte: number
  resonance: number
}

export function emptyResourceState(): ResourceState {
  return { energy: 0, concerto: 0, forte: 0, resonance: 0 }
}

export type Duration =
  | { kind: "permanent" }
  | { kind: "frames"; v: number }
  | { kind: "seconds"; v: number }

export type StackingPolicy = {
  max: number
  onRetrigger:
    | "refresh"
    | "addStack"
    | "addStackKeepTimer"
    | "ignore"
    | "replace"
}

export interface BuffDef {
  id: string
  name: string
  description?: string
  trigger: Trigger
  target: BuffTarget
  effects: Effect[]
  duration: Duration
  /** Default `{ max: 1, onRetrigger: "refresh" }` when omitted. */
  stacking?: StackingPolicy
  /** Resonance chain sequence required (1..6). v1 only filters at bootstrap. */
  requiresSequence?: number
  /** Echo set piece count required (2 or 5). v1 only filters at bootstrap. */
  requiresPieces?: 2 | 5
  /** v1 placeholder — typed but not enforced (#61). */
  nonStackingGroup?: string
  /** Continuously evaluated; gates whether instance contributes effects. */
  condition?: Condition
  /** When true, instance is removed when its source character swaps out. */
  expiresOnSourceSwapOut?: boolean
}

export interface BuffInstance {
  def: BuffDef
  sourceCharacterId: number
  targetCharacterId: number
  endTime: number
  stacks: number
  appliedFrame: number
}
