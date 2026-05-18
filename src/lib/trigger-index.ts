import type { BuffDef, ResourceKind } from "#/types/buff"

export class TriggerIndex {
  private byKey: Map<string, number[]>

  constructor(triggerable: BuffDef[]) {
    this.byKey = new Map()
    for (const def of triggerable) {
      const t = def.trigger
      if (t.event !== "resourceCrossed") continue
      const key = `${t.resource}:${t.direction}`
      const list = this.byKey.get(key) ?? []
      if (!list.includes(t.threshold)) list.push(t.threshold)
      this.byKey.set(key, list)
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
    const list = this.byKey.get(key)
    if (!list || list.length === 0) return []
    if (direction === "up") {
      return list.filter((t) => t > before && t <= after)
    } else {
      return list.filter((t) => t >= after && t < before)
    }
  }
}
