import type { ResourceKind, ResourceState } from "#/types/buff"
import { emptyResourceState } from "#/types/buff"

export interface ResourceCrossingInfo {
  before: number
  after: number
}

export class ResourceLedger {
  private resources = new Map<number, ResourceState>()

  clear(): void {
    this.resources.clear()
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
    const after = before + delta
    state[resource] = after
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
    return { before, after: value }
  }
}
