import type { BuffInstance, Condition, ResourceKind } from "#/types/buff"

export interface ConditionSubject {
  sourceCharacterId: number
  targetCharacterId: number
}

export interface ConditionWorld {
  hasActiveBuff: (buffId: string, characterId: number) => boolean
  isOnField: (characterId: number) => boolean
  getResourceValue: (characterId: number, resource: ResourceKind) => number
  /**
   * Returns a version tuple used by ConditionEvaluator as a cache-invalidation key.
   * INVARIANT: every subsystem read by evaluateUncached must appear in this tuple.
   * If you add a new Condition.kind that reads a new subsystem (e.g. footing, echoes),
   * add that subsystem's version here — otherwise evaluateCached will stale-hit across
   * changes to that subsystem and conditions will evaluate incorrectly.
   */
  mutationVersions: () => { store: number; resources: number; onField: number }
}

type CacheVersions = { store: number; resources: number; onField: number }

function cacheKey(
  buffId: string,
  sourceId: number,
  targetId: number,
  actingId: number,
): string {
  return `${buffId}|${sourceId}|${targetId}|${actingId}`
}

function subjectFromInstance(inst: BuffInstance): ConditionSubject {
  return {
    sourceCharacterId: inst.sourceCharacterId,
    targetCharacterId: inst.targetCharacterId,
  }
}

export class ConditionEvaluator {
  private cache = new Map<string, boolean>()
  private cacheVersions: CacheVersions | null = null
  private evalCount = 0

  constructor(private world: ConditionWorld) {}

  evaluateCached(
    cond: Condition,
    inst: BuffInstance,
    actingCharacterId: number,
  ): boolean {
    const curr = this.world.mutationVersions()
    const prev = this.cacheVersions
    if (
      prev === null ||
      prev.store !== curr.store ||
      prev.resources !== curr.resources ||
      prev.onField !== curr.onField
    ) {
      this.cache.clear()
      this.cacheVersions = curr
    }
    const key = cacheKey(
      inst.def.id,
      inst.sourceCharacterId,
      inst.targetCharacterId,
      actingCharacterId,
    )
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached
    const result = this.evaluateUncached(cond, subjectFromInstance(inst))
    this.evalCount++
    this.cache.set(key, result)
    return result
  }

  evaluateUncached(cond: Condition, subject: ConditionSubject): boolean {
    switch (cond.kind) {
      case "buffActive": {
        const id =
          cond.on === "source"
            ? subject.sourceCharacterId
            : subject.targetCharacterId
        const present = this.world.hasActiveBuff(cond.buffId, id)
        return cond.negate ? !present : present
      }
      case "onField":
        return this.world.isOnField(subject.targetCharacterId)
      case "actorIsOnField":
        return this.world.isOnField(subject.sourceCharacterId)
      case "actorIsOffField":
        return !this.world.isOnField(subject.sourceCharacterId)
      case "resourceAtLeast": {
        const id =
          cond.on === "source"
            ? subject.sourceCharacterId
            : subject.targetCharacterId
        return this.world.getResourceValue(id, cond.resource) >= cond.n
      }
    }
  }

  /** @internal Test-only. */
  evalCountForTest(): number {
    return this.evalCount
  }
}
