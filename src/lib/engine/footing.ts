import type { Footing } from "#/types/character"
import { FootingTracker } from "./footing-tracker"

export class FootingModule {
  private tracker = new FootingTracker()

  clear(): void {
    this.tracker.clear()
  }

  // Current team footing — the on-field character's vertical state.
  current(): "ground" | "air" {
    return this.tracker.current()
  }

  // Trailing-window deferred commit: a launch/land that fell in a swap tail and
  // survived re-entry. Called by the Trailing Window when the owner is on-field.
  commit(exitFooting: "ground" | "air"): void {
    this.tracker.setTeam(exitFooting)
  }

  // On-field stage commit: if a launch/land event lands within stageDuration, update team footing.
  applyStageFooting(footing: Footing | undefined, stageDuration: number): void {
    if (!footing || typeof footing !== "object") return
    if ("launch" in footing && footing.launch <= stageDuration) {
      this.tracker.setTeam("air")
    } else if ("land" in footing && footing.land <= stageDuration) {
      this.tracker.setTeam("ground")
    }
  }
}
