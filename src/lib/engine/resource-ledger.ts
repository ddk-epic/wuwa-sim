import type { ResourceKind, ResourceState } from "#/types/buff"
import { emptyResourceState } from "#/types/buff"

export interface ResourceCrossingInfo {
  before: number
  after: number
}

export class ResourceLedger {
  private resources = new Map<number, ResourceState>()
  private caps = new Map<number, Partial<Record<ResourceKind, number>>>()
  private version_ = 0

  clear(): void {
    this.resources.clear()
    this.version_++
  }

  clearCaps(): void {
    this.caps.clear()
  }

  registerCap(characterId: number, resource: ResourceKind, cap: number): void {
    let entry = this.caps.get(characterId)
    if (!entry) {
      entry = {}
      this.caps.set(characterId, entry)
    }
    entry[resource] = cap
  }

  mutationVersion(): number {
    return this.version_
  }

  ensureState(characterId: number): void {
    if (!this.resources.has(characterId)) {
      this.resources.set(characterId, emptyResourceState())
    }
  }

  getResource(characterId: number): ResourceState {
    let state = this.resources.get(characterId)
    if (!state) {
      state = emptyResourceState()
      this.resources.set(characterId, state)
    }
    return state
  }

  applyDelta(
    characterId: number,
    resource: ResourceKind,
    delta: number,
  ): ResourceCrossingInfo {
    const state = this.getResource(characterId)
    const before = state[resource]
    const cap = this.caps.get(characterId)?.[resource]
    const capped =
      cap !== undefined ? Math.min(before + delta, cap) : before + delta
    // Floor at 0: no resource goes negative regardless of authoring.
    const after = Math.max(0, capped)
    state[resource] = after
    if (before !== after) this.version_++
    return { before, after }
  }

  setValue(
    characterId: number,
    resource: ResourceKind,
    value: number,
  ): ResourceCrossingInfo {
    const state = this.getResource(characterId)
    const before = state[resource]
    state[resource] = value
    if (before !== value) this.version_++
    return { before, after: value }
  }
}
