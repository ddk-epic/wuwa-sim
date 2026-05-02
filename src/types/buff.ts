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

export type StatEffect = {
  kind: "stat"
  path: StatPath
  value: ValueExpr
}

export type Effect = StatEffect

export type Trigger = { event: "simStart" }

export type BuffTarget = { kind: "self" } | { kind: "team" }

export type Duration =
  | { kind: "permanent" }
  | { kind: "frames"; v: number }
  | { kind: "seconds"; v: number }

export interface BuffDef {
  id: string
  name: string
  description?: string
  trigger: Trigger
  target: BuffTarget
  effects: Effect[]
  duration: Duration
  /** Resonance chain sequence required (1..6). v1 only filters at bootstrap. */
  requiresSequence?: number
  /** Echo set piece count required (2 or 5). v1 only filters at bootstrap. */
  requiresPieces?: 2 | 5
  /** v1 placeholder — typed but not enforced (#61). */
  nonStackingGroup?: string
}

export interface BuffInstance {
  def: BuffDef
  sourceCharacterId: number
  targetCharacterId: number
  endTime: number
  stacks: number
  appliedFrame: number
}
