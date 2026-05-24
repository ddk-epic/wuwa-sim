import type { Footing } from "#/types/character"
import { FootingTracker } from "./footing-tracker"

export class FootingModule {
  private tracker = new FootingTracker()

  clear(): void {
    this.tracker.clear()
  }

  // (1) Off-field trailing commit: record that `characterId` will carry `exitFooting` into the next swap-in.
  snapshotTrailing(characterId: number, exitFooting: "ground" | "air"): void {
    this.tracker.snapshotFor(characterId, exitFooting)
  }

  // (2) Swap-in promotion: consume any pending snapshot, apply it to team footing, return effective footing.
  promoteOnSwapIn(characterId: number): "ground" | "air" {
    const snap = this.tracker.consumeSnapshot(characterId)
    if (snap !== null) this.tracker.setTeam(snap)
    return this.tracker.current()
  }

  // (3) On-field stage commit: if a launch/land event lands within stageDuration, update team footing and discard any pending snapshot.
  applyStageFooting(
    characterId: number,
    footing: Footing | undefined,
    stageDuration: number,
  ): void {
    if (!footing || typeof footing !== "object") return
    if ("launch" in footing && footing.launch <= stageDuration) {
      this.tracker.setTeam("air")
      this.tracker.clearSnapshot(characterId)
    } else if ("land" in footing && footing.land <= stageDuration) {
      this.tracker.setTeam("ground")
      this.tracker.clearSnapshot(characterId)
    }
  }

  // (4) End-of-timeline cleanup: discard a pending snapshot that will never be promoted.
  clearTrailingSnapshot(characterId: number): void {
    this.tracker.clearSnapshot(characterId)
  }
}
