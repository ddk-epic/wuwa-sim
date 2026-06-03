/** A generic frame-ordered pending-work pool. Resolution runs in a caller-supplied callback. */

/**
 * How a same-character re-entry collides with a pending item:
 *
 * - **residue** — dropped on a cancel-capable re-entry (at/after its frame),
 *   padded past on a non-cancel-capable one.
 * - **reset** — cancelled if the owner re-enters strictly before its frame.
 * - **ignore** — never invalidated by any arrival.
 */
export type ArrivalClass = "residue" | "reset" | "ignore"

/** One unit of pending work, drained in nondecreasing `frame` order. */
export interface ScheduledWork<T> {
  /** The frame at which this item resolves. */
  frame: number
  /** The character whose re-entry collides with this item; absent = uncollidable. */
  owner?: number
  arrival: ArrivalClass
  payload: T
}

interface ScheduleItem<T> extends ScheduledWork<T> {
  valid: boolean
}

export class Schedule<T> {
  private items: ScheduleItem<T>[] = []

  enqueue(w: ScheduledWork<T>): void {
    this.items.push({ ...w, valid: true })
  }

  /**
   * Resolve a same-character re-entry against this owner's pending items.
   * Returns `padFrames`: frames to advance the caller's cursor (0 unless a
   * non-cancel-capable re-entry collides with residue).
   */
  resolveArrival(
    owner: number,
    cancelCapable: boolean,
    frame: number,
  ): { padFrames: number } {
    // reset items cancel on any arrival strictly before their frame.
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
   * Drain items landing at/before `upto` in nondecreasing frame order via
   * `resolve`. Items enqueued during the drain land in the same drain;
   * invalidated items are skipped.
   */
  drainUpTo(upto: number, resolve: (payload: T) => void): void {
    for (;;) {
      // Stable sort keeps equal-frame items in insertion order.
      this.items.sort((a, b) => a.frame - b.frame)
      if (this.items.length === 0 || this.items[0].frame > upto) return
      const next = this.items.shift() as ScheduleItem<T>
      if (!next.valid) continue
      resolve(next.payload)
    }
  }
}
