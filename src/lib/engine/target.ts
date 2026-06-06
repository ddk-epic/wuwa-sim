import type { NegStatusType } from "#/data/neg-status-types"
import type {
  NegStatusDef,
  NegStatusInstance,
  TargetParams,
} from "#/types/target"
import { DEFAULT_TARGET_PARAMS } from "#/types/target"

const FPS = 60

export class Target {
  private params: TargetParams = { ...DEFAULT_TARGET_PARAMS }
  private statuses = new Map<NegStatusType, NegStatusInstance>()
  private version = 0

  reset(params: Partial<TargetParams> = {}): void {
    this.params = { ...DEFAULT_TARGET_PARAMS, ...params }
    this.statuses.clear()
    this.version++
  }

  getParams(): TargetParams {
    return this.params
  }

  mutationVersion(): number {
    return this.version
  }

  private endTimeFor(def: NegStatusDef, frame: number): number {
    return frame + def.duration * FPS
  }

  apply(
    def: NegStatusDef,
    n: number,
    frame: number,
    sourceCharacterId: number,
  ): boolean {
    const existing = this.statuses.get(def.type)
    let created = false
    if (existing) {
      existing.stacks = Math.min(existing.stacks + n, existing.cap)
      existing.endTime = this.endTimeFor(def, frame)
      existing.sourceCharacterId = sourceCharacterId
    } else {
      this.statuses.set(def.type, {
        def,
        stacks: Math.min(n, def.cap),
        cap: def.cap,
        endTime: this.endTimeFor(def, frame),
        sourceCharacterId,
        nextTickFrame: Infinity,
      })
      created = true
    }
    this.version++
    return created
  }

  reduceBy(type: NegStatusType, n: number): void {
    const existing = this.statuses.get(type)
    if (!existing) return
    existing.stacks -= n
    if (existing.stacks <= 0) {
      this.statuses.delete(type)
    }
    this.version++
  }

  raiseToMax(
    def: NegStatusDef,
    frame: number,
    sourceCharacterId: number,
  ): boolean {
    const existing = this.statuses.get(def.type)
    let created = false
    if (existing) {
      existing.stacks = existing.cap
      existing.endTime = this.endTimeFor(def, frame)
      existing.sourceCharacterId = sourceCharacterId
    } else {
      this.statuses.set(def.type, {
        def,
        stacks: def.cap,
        cap: def.cap,
        endTime: this.endTimeFor(def, frame),
        sourceCharacterId,
        nextTickFrame: Infinity,
      })
      created = true
    }
    this.version++
    return created
  }

  raiseCap(type: NegStatusType, n: number): void {
    const existing = this.statuses.get(type)
    if (!existing) return
    existing.cap += n
    this.version++
  }

  getInstance(type: NegStatusType): NegStatusInstance | undefined {
    return this.statuses.get(type)
  }

  setNextTick(type: NegStatusType, frame: number): void {
    const inst = this.statuses.get(type)
    if (inst) inst.nextTickFrame = frame
  }

  hasAnyStatus(): boolean {
    return this.statuses.size > 0
  }

  has(type: NegStatusType): boolean {
    return this.statuses.has(type)
  }

  stacksOf(type: NegStatusType): number {
    return this.statuses.get(type)?.stacks ?? 0
  }

  list(): NegStatusInstance[] {
    return [...this.statuses.values()].sort((a, b) =>
      a.def.type < b.def.type ? -1 : a.def.type > b.def.type ? 1 : 0,
    )
  }

  expireBefore(frame: number): void {
    let changed = false
    for (const [type, inst] of this.statuses) {
      if (inst.endTime <= frame) {
        this.statuses.delete(type)
        changed = true
      }
    }
    if (changed) this.version++
  }
}
