import type { BuffDef, ResourceKind } from "#/types/buff"

export class TriggerIndex {
  /** Explicit `resourceCrossed` thresholds, keyed `resource:direction`. */
  private byKey: Map<string, number[]>
  /** `resourceStep` steps, keyed `resource:direction`. Expanded per query. */
  private stepsByKey: Map<string, number[]>

  constructor(triggerable: BuffDef[]) {
    this.byKey = new Map()
    this.stepsByKey = new Map()
    for (const def of triggerable) {
      const t = def.trigger
      if (t.event === "resourceCrossed") {
        const key = `${t.resource}:${t.direction}`
        const list = this.byKey.get(key) ?? []
        if (!list.includes(t.threshold)) list.push(t.threshold)
        this.byKey.set(key, list)
      } else if (t.event === "resourceStep") {
        // "consumed" is a downward crossing, "gained" an upward one.
        const direction = t.direction === "gained" ? "up" : "down"
        const key = `${t.resource}:${direction}`
        const steps = this.stepsByKey.get(key) ?? []
        if (t.step > 0 && !steps.includes(t.step)) steps.push(t.step)
        this.stepsByKey.set(key, steps)
      }
    }
    for (const list of this.byKey.values()) list.sort((a, b) => a - b)
  }

  crossedThresholds(
    resource: ResourceKind,
    direction: "up" | "down",
    before: number,
    after: number,
  ): number[] {
    if (before === after) return []
    const key = `${resource}:${direction}`
    const crossed = new Set<number>()

    const list = this.byKey.get(key)
    if (list) {
      for (const t of list) {
        const hit =
          direction === "up"
            ? t > before && t <= after
            : t >= after && t < before
        if (hit) crossed.add(t)
      }
    }

    const steps = this.stepsByKey.get(key)
    if (steps) {
      for (const step of steps) {
        if (direction === "up") {
          // before < m <= after, for each multiple m of step.
          for (
            let m = Math.floor(before / step) * step + step;
            m <= after;
            m += step
          ) {
            crossed.add(m)
          }
        } else {
          // after <= m < before, for each multiple m of step.
          for (let m = Math.ceil(after / step) * step; m < before; m += step) {
            crossed.add(m)
          }
        }
      }
    }

    return [...crossed].sort((a, b) => a - b)
  }
}
