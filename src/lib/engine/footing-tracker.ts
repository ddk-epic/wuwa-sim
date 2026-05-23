export class FootingTracker {
  private current_: "ground" | "air" = "ground"
  private version_ = 0
  private snapshots_ = new Map<number, "ground" | "air">()

  clear(): void {
    this.current_ = "ground"
    this.snapshots_.clear()
    this.version_++
  }

  current(): "ground" | "air" {
    return this.current_
  }

  setCurrent(footing: "ground" | "air"): void {
    if (this.current_ === footing) return
    this.current_ = footing
    this.version_++
  }

  mutationVersion(): number {
    return this.version_
  }

  snapshotOnSwapOut(characterId: number, footing: "ground" | "air"): void {
    this.snapshots_.set(characterId, footing)
  }

  consumeSnapshot(characterId: number): "ground" | "air" | null {
    const snap = this.snapshots_.get(characterId) ?? null
    this.snapshots_.delete(characterId)
    return snap
  }

  clearSnapshot(characterId: number): void {
    this.snapshots_.delete(characterId)
  }
}
