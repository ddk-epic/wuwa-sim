import type { Footing } from "#/types/character"
import { stageExitFooting } from "#/lib/stage"
import { FootingTracker } from "./footing-tracker"

export class FootingModule {
  private tracker = new FootingTracker()

  clear(): void {
    this.tracker.clear()
  }

  /** Team footing — the field's vertical state (the On-field character's). */
  team(): "ground" | "air" {
    return this.tracker.team()
  }

  /**
   * On-field stage commit: a launch/land whose commit frame falls within the
   * stage's own duration updates team footing immediately (the character never
   * leaves the field, so it is not a stream event).
   */
  applyStageFooting(footing: Footing | undefined, stageDuration: number): void {
    if (typeof footing === "object") {
      if ("launch" in footing && footing.launch <= stageDuration) {
        this.tracker.setTeam("air")
      } else if ("land" in footing && footing.land <= stageDuration) {
        this.tracker.setTeam("ground")
      }
      return
    }
    const exit = stageExitFooting(footing)
    if (exit !== undefined) this.tracker.setTeam(exit)
  }

  /**
   * An Intro Skill ignores the footing it enters on — it can take the field on any
   * footing (see `references/footing.md`) — and instead establishes its own exit
   * footing. An untagged intro grounds (the default); only `"either"` keeps the
   * current footing.
   */
  applyIntroFooting(footing: Footing | undefined): void {
    const exit = stageExitFooting(footing)
    if (exit !== undefined) this.tracker.setTeam(exit)
  }

  /**
   * Set a character's carried footing — the effect of a footing stream event: a
   * launch/land commit (`air`/`ground`) fired while the owner is [[In-trailing]],
   * or the window-end reset to `ground`. Instant: a single-frame flip. It does
   * not touch team footing (the owner is off-field), only what that character
   * will take the field on at its next swap-in.
   */
  commitFor(characterId: number, exitFooting: "ground" | "air"): void {
    this.tracker.setCarriedFooting(characterId, exitFooting)
  }

  /**
   * The footing a character takes the field on as it begins an entry: its
   * carried override if it has one (a swap-back during its trailing window, or a
   * benched character carrying `ground`), otherwise team footing (a fresh
   * swap-in inherits the field). Consumes the override and promotes the result
   * to team footing — the field now reflects whoever is On-field.
   */
  resolveEntry(characterId: number): "ground" | "air" {
    const carried = this.tracker.carriedFooting(characterId)
    if (carried !== undefined) {
      this.tracker.setTeam(carried)
      this.tracker.clearCarriedFooting(characterId)
      return carried
    }
    return this.tracker.team()
  }
}
