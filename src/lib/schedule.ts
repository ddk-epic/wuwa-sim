/**
 * `Schedule<T>` — the simulator's frame-ordered pending-work pool (ADR-0028),
 * extracted as a deep, mechanism-only module. It owns ordering, the watermark
 * drain, and the same-character collision protocol (`resolveArrival`), but
 * **not** resolution: each item's effect runs in a caller-supplied `resolve`
 * callback. It is therefore generic and opaque to its payload — it imports
 * nothing from the buff engine, damage formulas, or Simulation Log.
 *
 * See CONTEXT.md `Schedule` entry and ADR-0028.
 */

/**
 * How a same-character re-entry collides with a pending item. The device that
 * keeps `resolveArrival` domain-blind — it branches only on this class plus
 * owner / frame / cancel-capability, never on trailing/footing/synthetic kinds:
 *
 * - **residue** — dropped on a cancel-capable re-entry (at/after its frame),
 *   padded past on a non-cancel-capable one.
 * - **reset** — cancelled if the owner re-enters strictly before its frame.
 * - **ignore** — fire-and-forget; never invalidated by any arrival.
 */
export type ArrivalClass = "residue" | "reset" | "ignore"

/** One unit of pending work, drained in nondecreasing `frame` order. */
export interface ScheduledWork<T> {
  /** The landing frame at which this item resolves. */
  frame: number
  /** The character whose re-entry collides with this item; absent = uncollidable. */
  owner?: number
  arrival: ArrivalClass
  payload: T
}

/** Internal item — carries the tombstone the caller never sees. */
interface ScheduleItem<T> extends ScheduledWork<T> {
  valid: boolean
}

export class Schedule<T> {
  private items: ScheduleItem<T>[] = []

  enqueue(w: ScheduledWork<T>): void {
    this.items.push({ ...w, valid: true })
  }

  /**
   * Resolve a same-character re-entry against this owner's pending items:
   *
   *  - **reset-cancel** (unconditional, runs every arrival): a re-entry strictly
   *    before a `reset` item's frame invalidates it;
   *  - **drop** (cancel-capable re-entry): invalidate `residue` items at/after
   *    the frame so the drain skips them;
   *  - **pad** (non-cancel-capable re-entry that collides): return `padFrames`
   *    to push the cursor past the latest residue so every residue item lands.
   *
   * Returns `{ padFrames }`: the frames to advance the caller's cursor (0 unless
   * a non-cancel-capable re-entry collides with residue).
   */
  resolveArrival(
    owner: number,
    cancelCapable: boolean,
    frame: number,
  ): { padFrames: number } {
    // Reset-cancel is orthogonal — it runs on every arrival regardless of
    // cancel-capability or whether any residue collides.
    for (const it of this.items) {
      if (
        it.valid &&
        it.owner === owner &&
        it.arrival === "reset" &&
        frame < it.frame
      ) {
        it.valid = false
      }
    }

    const residue = this.items.filter(
      (it) => it.valid && it.owner === owner && it.arrival === "residue",
    )
    const collides = residue.some((it) => it.frame >= frame)
    if (!collides) return { padFrames: 0 }

    if (cancelCapable) {
      for (const it of residue) if (it.frame >= frame) it.valid = false
      return { padFrames: 0 }
    }

    const latest = residue.reduce((m, it) => Math.max(m, it.frame), -Infinity)
    return { padFrames: latest - frame }
  }

  /**
   * Drain pending items up to `upto`, resolving each at/before it in
   * nondecreasing frame order via `resolve`. A stable re-sort each iteration
   * preserves within-frame insertion order for free; items a `resolve` enqueues
   * land in the same drain in frame order. Invalidated (tombstoned) items are
   * skipped.
   */
  drainUpTo(upto: number, resolve: (payload: T) => void): void {
    for (;;) {
      // Array.prototype.sort is stable, so equal-frame items keep insertion order.
      this.items.sort((a, b) => a.frame - b.frame)
      if (this.items.length === 0 || this.items[0].frame > upto) return
      const next = this.items.shift() as ScheduleItem<T>
      if (!next.valid) continue
      resolve(next.payload)
    }
  }
}
