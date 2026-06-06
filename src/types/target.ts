import type { Element } from "#/data/elements"
import type { NegStatusType } from "#/data/neg-status-types"

export interface NegStatusDef {
  type: NegStatusType
  element: Element
  cap: number
  duration: number
  tickInterval: number
  baseUnit: number
  stackFactor: Record<number, number>
}

export interface NegStatusInstance {
  def: NegStatusDef
  stacks: number
  cap: number
  endTime: number
  sourceCharacterId: number
}

export interface TargetParams {
  level: number
  defMultConst: number
  resMultConst: number
}

export const DEFAULT_TARGET_PARAMS: TargetParams = {
  level: 100,
  defMultConst: 0.5,
  resMultConst: 0.9,
}
