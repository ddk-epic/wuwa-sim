import type {
  BuffDef,
  CoordHitEffect,
  EmitHitEffect,
  HitContext,
  ResourceState,
} from "#/types/buff"
import type { HealTarget } from "#/types/character"
import type { ActiveBuff, HitEvent, SustainEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { getCharacterById } from "../loadout/catalog"
import { computeDamage } from "../damage/compute-damage"
import { computeHealing } from "../damage/compute-healing"
import { cloneStats } from "./stat-table-builder"

declare const buffInstanceKeyBrand: unique symbol
export type BuffInstanceKey = string & { readonly [buffInstanceKeyBrand]: true }

export function buffInstanceKey(
  defId: string,
  sourceCharacterId: number,
): BuffInstanceKey {
  // Sole construction site for the branded key; the cast applies the brand.
  return `${defId}|${sourceCharacterId}` as BuffInstanceKey
}

export interface EmitHitDispatchContext {
  frame: number
  depth: number
}

export interface EmitHitInput {
  buffInstanceKey: BuffInstanceKey
  def: BuffDef
  effect: EmitHitEffect | CoordHitEffect
  effectIndex: number
  sourceCharacterId: number
}

/**
 * An emit whose decision (ICD/chain) was taken at the trigger frame but whose
 * damage resolves later, at `landingFrame` (= trigger + `actionFrame`). `depth`
 * carries the chain depth for the resolution's own chain.
 */
export interface DeferredEmit {
  input: EmitHitInput
  landingFrame: number
  depth: number
}

/**
 * Snapshot-only host: what {@link buildSyntheticEvent} needs to read the active
 * buff lists and heal targets. Stat resolution and resource accrual are owned by
 * the engine now (#321) — the dispatcher no longer touches either.
 */
export interface EmitHitHost {
  activeBuffs: (characterId: number, hit?: HitContext) => ActiveBuff[]
  passiveBuffs: (characterId: number) => ActiveBuff[]
  resolveHealTargets: (
    target: HealTarget,
    sourceCharacterId: number,
  ) => number[]
}

export interface EmitHitDispatcherOptions {
  chainDepthCap: number
}

export class EmitHitDispatcher {
  private icd = new Map<BuffInstanceKey, Map<number, number>>()
  private readonly chainDepthCap: number

  constructor(opts: EmitHitDispatcherOptions) {
    this.chainDepthCap = opts.chainDepthCap
  }

  reset(): void {
    this.icd.clear()
  }

  /**
   * The emit decision, taken at the trigger frame: ICD interval + chain depth cap,
   * recording the ICD on success. Returns false when the emit is blocked.
   */
  tryEmit(input: EmitHitInput, ctx: EmitHitDispatchContext): boolean {
    const perEffect = this.icd.get(input.buffInstanceKey)
    const last = perEffect?.get(input.effectIndex)
    if (last !== undefined && ctx.frame - last < input.effect.icdFrames) {
      return false
    }

    if (ctx.depth + 1 > this.chainDepthCap) {
      console.warn(
        `[BuffEngine] emitHit chain depth exceeded ${this.chainDepthCap} (buff: ${input.def.id}, source: ${input.sourceCharacterId}); stopping chain`,
      )
      return false
    }

    if (perEffect) {
      perEffect.set(input.effectIndex, ctx.frame)
    } else {
      this.icd.set(
        input.buffInstanceKey,
        new Map([[input.effectIndex, ctx.frame]]),
      )
    }
    return true
  }
}

/**
 * Construct the synthetic Hit/Sustain event from already-resolved `stats` and
 * post-delta `post` resources. The caller decides at which frame to read
 * `stats`/`post`.
 */
export function buildSyntheticEvent(
  input: EmitHitInput,
  frame: number,
  stats: StatTable,
  post: ResourceState,
  host: EmitHitHost,
  hitCtx?: HitContext,
): HitEvent | SustainEvent {
  const character = getCharacterById(input.sourceCharacterId)
  const skillType = input.effect.skillType ?? input.effect.damage.type
  const isCoord = input.effect.kind === "coordHit"

  if (input.effect.damage.dmgType === "Heal") {
    const amount = computeHealing(
      {
        multiplier: input.effect.damage.value,
        scalingStat: input.effect.damage.scalingStat,
        flat: input.effect.damage.flat,
      },
      stats,
    )
    return {
      kind: "sustain",
      sub: "heal",
      synthetic: true,
      ...(isCoord && { coord: true as const }),
      sourceBuffId: input.def.id,
      characterId: input.sourceCharacterId,
      skillType,
      skillName: input.def.name,
      frame,
      cumulativeEnergy: post.energy,
      cumulativeConcerto: post.concerto,
      amount,
      targets: host.resolveHealTargets(
        input.effect.damage.target ?? "self",
        input.sourceCharacterId,
      ),
      scalingStat: input.effect.damage.scalingStat,
      multiplier: input.effect.damage.value,
      flat: input.effect.damage.flat,
      statsSnapshot: cloneStats(stats),
      activeBuffs: host.activeBuffs(input.sourceCharacterId, hitCtx),
      passiveBuffs: host.passiveBuffs(input.sourceCharacterId),
    }
  }

  const element = input.effect.element ?? character?.element ?? "Physical"
  const damage = computeDamage(
    {
      multiplier: input.effect.damage.value,
      element,
      skillType,
      dmgType: input.effect.damage.dmgType,
      scalingStat: input.effect.damage.scalingStat,
    },
    stats,
  )

  return {
    kind: "hit",
    synthetic: true,
    ...(isCoord && { coord: true as const }),
    sourceBuffId: input.def.id,
    characterId: input.sourceCharacterId,
    skillType,
    skillName: input.def.name,
    frame,
    cumulativeEnergy: post.energy,
    cumulativeConcerto: post.concerto,
    damage,
    element,
    dmgType: input.effect.damage.dmgType,
    scalingStat: input.effect.damage.scalingStat,
    multiplier: input.effect.damage.value,
    statsSnapshot: cloneStats(stats),
    activeBuffs: host.activeBuffs(input.sourceCharacterId, hitCtx),
    passiveBuffs: host.passiveBuffs(input.sourceCharacterId),
  }
}
