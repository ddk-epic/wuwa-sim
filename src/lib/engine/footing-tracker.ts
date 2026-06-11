/**
 * Footing state. Holds two things:
 *
 * - **team footing** — the field's current vertical state, i.e. the On-field
 *   character's footing. A fresh swap-in inherits it (swap while airborne → the
 *   incoming character is airborne too).
 * - **carried footing** — a per-character override set while a character is
 *   [[In-trailing]] (its launch/land commit fired off-field) or benched (the
 *   window-end reset). Consumed when that character next swaps in, so a
 *   swap-back during its own trailing window enters on its own evolved footing
 *   rather than the field's.
 */
export class FootingTracker {
  private team_: "ground" | "air" = "ground"
  private carried = new Map<number, "ground" | "air">()
  private version_ = 0

  clear(): void {
    this.team_ = "ground"
    this.carried.clear()
    this.version_++
  }

  teamFooting(): "ground" | "air" {
    return this.team_
  }

  setTeam(footing: "ground" | "air"): void {
    if (this.team_ === footing) return
    this.team_ = footing
    this.version_++
  }

  carriedFor(characterId: number): "ground" | "air" | undefined {
    return this.carried.get(characterId)
  }

  setCarried(characterId: number, footing: "ground" | "air"): void {
    this.carried.set(characterId, footing)
    this.version_++
  }

  takeCarried(characterId: number): void {
    if (this.carried.delete(characterId)) this.version_++
  }

  mutationVersion(): number {
    return this.version_
  }
}
