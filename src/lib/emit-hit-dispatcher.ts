import type {
  BuffDef,
  EmitHitEffect,
  ResourceKind,
  ResourceState,
} from "#/types/buff"
import type { BuffEvent, HitEvent } from "#/types/simulation-log"
import type { StatTable } from "#/types/stat-table"
import { getCharacterById } from "./catalog"
import { computeDamage } from "./compute-damage"

declare const buffInstanceKeyBrand: unique symbol
export type BuffInstanceKey = string & { readonly [buffInstanceKeyBrand]: true }

export function buffInstanceKey(
  defId: string,
  sourceCharacterId: number,
): BuffInstanceKey {
  return `${defId}|${sourceCharacterId}` as BuffInstanceKey
}

export interface EmitHitDispatchContext {
  frame: number
  depth: number
}

export interface EmitHitInput {
  buffInstanceKey: BuffInstanceKey
  def: BuffDef
  effect: EmitHitEffect
  effectIndex: number
  sourceCharacterId: number
}

export interface EmitHitHost {
  resolveStats(characterId: number): StatTable
  applyResourceDelta(
    characterId: number,
    resource: ResourceKind,
    delta: number,
    frame: number,
    out: BuffEvent[],
    hitsOut: HitEvent[],
    depth: number,
  ): void
  getResource(characterId: number): ResourceState
  activeBuffIds(characterId: number): string[]
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

  /** Returns the synthetic hit, or null when ICD blocks or chain depth cap is reached. */
  dispatch(
    input: EmitHitInput,
    ctx: EmitHitDispatchContext,
    host: EmitHitHost,
    out: BuffEvent[],
    hitsOut: HitEvent[],
  ): HitEvent | null {
    const perEffect = this.icd.get(input.buffInstanceKey)
    const last = perEffect?.get(input.effectIndex)
    if (last !== undefined && ctx.frame - last < input.effect.icdFrames) {
      return null
    }

    if (ctx.depth + 1 > this.chainDepthCap) {
      console.warn(
        `[BuffEngine] emitHit chain depth exceeded ${this.chainDepthCap} (buff: ${input.def.id}, source: ${input.sourceCharacterId}); stopping chain`,
      )
      return null
    }

    if (perEffect) {
      perEffect.set(input.effectIndex, ctx.frame)
    } else {
      this.icd.set(
        input.buffInstanceKey,
        new Map([[input.effectIndex, ctx.frame]]),
      )
    }

    const stats = host.resolveStats(input.sourceCharacterId)
    const character = getCharacterById(input.sourceCharacterId)
    const element = input.effect.element ?? character?.element ?? ""
    const skillType = input.effect.skillType ?? "Coordinated Attack"
    const damage = computeDamage(
      {
        multiplier: input.effect.damage.value,
        element,
        skillType,
        dmgType: input.effect.damage.dmgType,
      },
      stats,
    )

    if (input.effect.damage.energy) {
      host.applyResourceDelta(
        input.sourceCharacterId,
        "energy",
        input.effect.damage.energy,
        ctx.frame,
        out,
        hitsOut,
        ctx.depth,
      )
    }
    if (input.effect.damage.concerto) {
      host.applyResourceDelta(
        input.sourceCharacterId,
        "concerto",
        input.effect.damage.concerto,
        ctx.frame,
        out,
        hitsOut,
        ctx.depth,
      )
    }
    const post = host.getResource(input.sourceCharacterId)

    return {
      kind: "hit",
      synthetic: true,
      sourceBuffId: input.def.id,
      characterId: input.sourceCharacterId,
      skillType,
      skillName: input.def.name,
      frame: ctx.frame,
      cumulativeEnergy: post.energy,
      cumulativeConcerto: post.concerto,
      damage,
      statsSnapshot: cloneStats(stats),
      activeBuffIds: host.activeBuffIds(input.sourceCharacterId),
    }
  }
}

function cloneStats(s: StatTable): StatTable {
  return {
    atkBase: s.atkBase,
    atkPct: s.atkPct,
    atkFlat: s.atkFlat,
    hpBase: s.hpBase,
    hpPct: s.hpPct,
    hpFlat: s.hpFlat,
    defBase: s.defBase,
    defPct: s.defPct,
    defFlat: s.defFlat,
    critRate: s.critRate,
    critDmg: s.critDmg,
    defShred: s.defShred,
    elementBonus: { ...s.elementBonus },
    skillTypeBonus: { ...s.skillTypeBonus },
    deepen: { ...s.deepen },
    resShred: { ...s.resShred },
  }
}
