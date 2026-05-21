export interface InferredSwap {
  prev: number | null
  next: number
}

export class OnFieldTracker {
  private current_: number | null = null
  private version_ = 0

  clear(): void {
    this.current_ = null
    this.version_++
  }

  current(): number | null {
    return this.current_
  }

  setCurrent(characterId: number | null): void {
    if (this.current_ === characterId) return
    this.current_ = characterId
    this.version_++
  }

  mutationVersion(): number {
    return this.version_
  }

  isOnField(characterId: number): boolean {
    return this.current_ === characterId
  }

  /**
   * Implicit swap inference: when a skillCast arrives from a different actor than
   * the current on-field character, returns {prev,next} so the caller can dispatch
   * swapOut/swapIn. Returns null when `next` is already on-field.
   */
  inferSwap(next: number): InferredSwap | null {
    if (this.current_ === next) return null
    return { prev: this.current_, next }
  }
}
