import type {
  BuffDef,
  CoordHitEffect,
  EmitHitEffect,
  HitContext,
  ResourceKind,
  ResourceState,
} from "#/types/buff"
import type { HealTarget } from "#/types/character"
import type {
  ActiveBuff,
  BuffEvent,
  HitEvent,
  SustainEvent,
} from "#/types/simulation-log"
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
 * damage resolves later, at `landingFrame` (= trigger + `actionFrame`). Surfaced
 * by the engine so the simulation can schedule and resolve it in frame order
 * (ADR-0028). `depth` carries the chain depth for the resolution's own chain.
 */
export interface DeferredEmit {
  input: EmitHitInput
  landingFrame: number
  depth: number
}

export interface EmitHitHost {
  resolveStats: (characterId: number, hit?: HitContext) => StatTable
  applyResourceDelta: (
    characterId: number,
    resource: ResourceKind,
    delta: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
    depth: number,
  ) => void
  getResource: (characterId: number) => ResourceState
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

  /** Returns the synthetic event, or null when ICD blocks or chain depth cap is reached. */
  dispatch(
    input: EmitHitInput,
    ctx: EmitHitDispatchContext,
    host: EmitHitHost,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
  ): HitEvent | SustainEvent | null {
    if (!this.tryEmit(input, ctx)) return null
    return this.resolve(input, ctx.frame, ctx.depth, host, out, hitsOut)
  }

  /**
   * The *emit decision*, taken at the trigger frame: ICD interval + chain depth
   * cap, recording the ICD on success. Returns false when the emit is blocked.
   * Split from {@link resolve} so a deferred emit can take its decision now and
   * resolve its damage later, at the landing frame (ADR-0028).
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

  /**
   * Resolve an already-decided emit into its synthetic event at `frame`: apply
   * its resource gains and snapshot via {@link buildSyntheticEvent}. The caller
   * supplies the frame — the trigger frame for an immediate emit, the landing
   * frame for a deferred one — and must have advanced engine state to it first.
   */
  resolve(
    input: EmitHitInput,
    frame: number,
    depth: number,
    host: EmitHitHost,
    out: BuffEvent[],
    hitsOut: (HitEvent | SustainEvent)[],
  ): HitEvent | SustainEvent {
    const character = getCharacterById(input.sourceCharacterId)
    const hitCtx: HitContext = {
      sourceBuffId: input.def.id,
      skillType: input.effect.skillType ?? input.effect.damage.type,
      element: input.effect.element ?? character?.element,
    }

    const stats = host.resolveStats(input.sourceCharacterId, hitCtx)

    if (input.effect.damage.energy) {
      host.applyResourceDelta(
        input.sourceCharacterId,
        "energy",
        input.effect.damage.energy * (1 + stats.energyRechargePct),
        frame,
        out,
        hitsOut,
        depth,
      )
    }
    if (input.effect.damage.concerto) {
      host.applyResourceDelta(
        input.sourceCharacterId,
        "concerto",
        input.effect.damage.concerto,
        frame,
        out,
        hitsOut,
        depth,
      )
    }
    const post = host.getResource(input.sourceCharacterId)

    return buildSyntheticEvent(input, frame, stats, post, host, hitCtx)
  }
}

/**
 * Construct the synthetic Hit/Sustain event from already-resolved `stats` and
 * post-delta `post` resources. Frame-sensitive *only* through its inputs — the
 * caller decides at which frame to read `stats`/`post`, so the same builder
 * serves both eager resolution (dispatcher, at the trigger frame) and the
 * deferred path (resolution at the synthetic's landing frame, ADR-0028).
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
