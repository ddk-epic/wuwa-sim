/**
 * Per-character Emit Pool: an ordered FIFO of Deferred Emits and the single
 * source of truth for the `"pool"` resource (count == member-list length). A
 * spawn pushes members; a conversion (maturation, displacement, or explicit
 * convert) removes one. Capacity and displacement are layered on later.
 */

/** One spawned Deferred Emit awaiting conversion into a Synthetic Hit. */
export interface PoolMember {
  /** Monotonic handle pairing the member with its scheduled maturation timer. */
  id: number
  spawnFrame: number
  maturationFrame: number
}

export class PoolStore {
  private byCharacter = new Map<number, PoolMember[]>()
  private nextId = 1

  clear(): void {
    this.byCharacter.clear()
    this.nextId = 1
  }

  /** Push one member onto the character's FIFO tail and return it. */
  spawn(
    characterId: number,
    spawnFrame: number,
    maturationFrame: number,
  ): PoolMember {
    const member: PoolMember = {
      id: this.nextId++,
      spawnFrame,
      maturationFrame,
    }
    const list = this.byCharacter.get(characterId)
    if (list) list.push(member)
    else this.byCharacter.set(characterId, [member])
    return member
  }

  /**
   * Enforce `cap` by popping the oldest members until the FIFO holds at `cap`,
   * returning the displaced members (oldest-first) for immediate conversion.
   * Empty when already at/under cap.
   */
  displaceOldest(characterId: number, cap: number): PoolMember[] {
    const list = this.byCharacter.get(characterId)
    if (!list || list.length <= cap) return []
    return list.splice(0, list.length - cap)
  }

  /** Remove the member by handle. Returns false when already gone (converted). */
  remove(characterId: number, memberId: number): boolean {
    const list = this.byCharacter.get(characterId)
    if (!list) return false
    const idx = list.findIndex((m) => m.id === memberId)
    if (idx === -1) return false
    list.splice(idx, 1)
    return true
  }

  count(characterId: number): number {
    return this.byCharacter.get(characterId)?.length ?? 0
  }
}
