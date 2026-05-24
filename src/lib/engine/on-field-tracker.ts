export interface InferredSwap {
  prev: number | null
  next: number
}

const SWAP_BACK_CD = 60

export class OnFieldTracker {
  private current_: number | null = null
  private version_ = 0
  private lastOffFieldFrame = new Map<number, number>()
  private pendingAnimAdvance_ = 0

  clear(): void {
    this.current_ = null
    this.version_++
    this.lastOffFieldFrame.clear()
    this.pendingAnimAdvance_ = 0
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

  recordSwapOut(characterId: number, frame: number): void {
    // Subtract accumulated animation advance so future swap-back computation
    // counts that animation wall-clock time as elapsed off-field time.
    this.lastOffFieldFrame.set(characterId, frame - this.pendingAnimAdvance_)
  }

  recordSwapIn(characterId: number): void {
    this.lastOffFieldFrame.delete(characterId)
  }

  /**
   * Advance every currently-tracked off-field character's clock by `frames`,
   * and accumulate so that characters who go off-field AFTER this call also
   * benefit. Used by cutscene animation stages whose wall-clock duration eats
   * into swap-back CDs without advancing the engine clock.
   */
  advanceOffFieldClocks(frames: number): void {
    for (const [id, lastFrame] of this.lastOffFieldFrame) {
      this.lastOffFieldFrame.set(id, lastFrame - frames)
    }
    this.pendingAnimAdvance_ += frames
  }

  computeSwapBack(characterId: number, arrivalFrame: number): number {
    const lastFrame = this.lastOffFieldFrame.get(characterId)
    if (lastFrame === undefined) return 0
    return Math.max(0, SWAP_BACK_CD - (arrivalFrame - lastFrame))
  }
}
