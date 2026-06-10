import { describe, it, expect } from "vitest"
import { Schedule } from "./schedule"
import type { ScheduledWork } from "./schedule"

/** Collect the payloads a full drain resolves, in resolution order. */
function drainAll<T>(s: Schedule<T>, upto = Infinity): T[] {
  const out: T[] = []
  s.drainUpTo(upto, (p) => out.push(p))
  return out
}

function work<T>(
  frame: number,
  payload: T,
  extra: Partial<Omit<ScheduledWork<T>, "frame" | "payload">> = {},
): ScheduledWork<T> {
  return { frame, arrival: "ignore", payload, ...extra }
}

describe("Schedule ordering", () => {
  it("drains in nondecreasing frame order, not enqueue (FIFO) order", () => {
    const s = new Schedule<string>()
    s.enqueue(work(14, "late"))
    s.enqueue(work(3, "early"))
    expect(drainAll(s)).toEqual(["early", "late"])
  })

  it("preserves within-frame insertion order (stable)", () => {
    const s = new Schedule<string>()
    s.enqueue(work(5, "a"))
    s.enqueue(work(5, "b"))
    s.enqueue(work(5, "c"))
    expect(drainAll(s)).toEqual(["a", "b", "c"])
  })
})

describe("Schedule watermark", () => {
  it("parks items landing strictly after the watermark", () => {
    const s = new Schedule<string>()
    s.enqueue(work(5, "at"))
    s.enqueue(work(10, "after"))
    expect(drainAll(s, 5)).toEqual(["at"])
    expect(drainAll(s, 10)).toEqual(["after"])
  })

  it("resolves items at the watermark frame (inclusive)", () => {
    const s = new Schedule<string>()
    s.enqueue(work(7, "exact"))
    expect(drainAll(s, 7)).toEqual(["exact"])
  })
})

describe("Schedule re-entrancy", () => {
  it("resolves an item enqueued during a drain in the same drain, in frame order", () => {
    const s = new Schedule<string>()
    s.enqueue(work(2, "first"))
    s.enqueue(work(10, "last"))
    const out: string[] = []
    s.drainUpTo(Infinity, (p) => {
      out.push(p)
      // "chained" lands at frame 5, between the two pending items.
      if (p === "first") s.enqueue(work(5, "chained"))
    })
    expect(out).toEqual(["first", "chained", "last"])
  })
})

describe("Schedule resolveArrival — residue", () => {
  it("does not drop residue on a cancel-capable re-entry — that runs at effectiveStart", () => {
    const s = new Schedule<string>()
    s.enqueue(work(20, "kept", { owner: 1, arrival: "residue" }))
    const { padFrames } = s.resolveArrival(1, true, 10)
    expect(padFrames).toBe(0)
    expect(drainAll(s)).toEqual(["kept"])
  })

  it("pads past the latest residue frame on a non-cancel-capable re-entry", () => {
    const s = new Schedule<string>()
    s.enqueue(work(18, "a", { owner: 1, arrival: "residue" }))
    s.enqueue(work(25, "b", { owner: 1, arrival: "residue" }))
    const { padFrames } = s.resolveArrival(1, false, 10)
    expect(padFrames).toBe(15) // latest − frame === 25 − 10
    expect(drainAll(s)).toEqual(["a", "b"])
  })

  it("returns zero pad and drops nothing when no residue collides", () => {
    const s = new Schedule<string>()
    s.enqueue(work(5, "before", { owner: 1, arrival: "residue" }))
    const { padFrames } = s.resolveArrival(1, false, 10)
    expect(padFrames).toBe(0)
    expect(drainAll(s)).toEqual(["before"])
  })
})

describe("Schedule cancelResidue", () => {
  it("drops own residue at/after the frame, keeps earlier residue", () => {
    const s = new Schedule<string>()
    s.enqueue(work(20, "drop-me", { owner: 1, arrival: "residue" }))
    s.enqueue(work(8, "kept", { owner: 1, arrival: "residue" }))
    s.cancelResidue(1, 10)
    expect(drainAll(s)).toEqual(["kept"])
  })

  it("only cancels the same owner's residue", () => {
    const s = new Schedule<string>()
    s.enqueue(work(20, "other", { owner: 2, arrival: "residue" }))
    s.cancelResidue(1, 10)
    expect(drainAll(s)).toEqual(["other"])
  })
})

describe("Schedule resolveArrival — reset", () => {
  it("cancels a reset item when re-entry is strictly before its frame", () => {
    const s = new Schedule<string>()
    s.enqueue(work(30, "reset", { owner: 1, arrival: "reset" }))
    s.resolveArrival(1, true, 20)
    expect(drainAll(s)).toEqual([])
  })

  it("lets a reset item fire when re-entry is at/after its frame", () => {
    const s = new Schedule<string>()
    s.enqueue(work(30, "reset", { owner: 1, arrival: "reset" }))
    s.resolveArrival(1, true, 30)
    expect(drainAll(s)).toEqual(["reset"])
  })

  it("cancels resets regardless of cancel-capability (orthogonal)", () => {
    const s = new Schedule<string>()
    s.enqueue(work(30, "reset", { owner: 1, arrival: "reset" }))
    s.resolveArrival(1, false, 20)
    expect(drainAll(s)).toEqual([])
  })
})

describe("Schedule resolveArrival — ignore", () => {
  it("never drops, pads against, or cancels ignore-class items", () => {
    const s = new Schedule<string>()
    s.enqueue(work(20, "synthetic", { owner: 1, arrival: "ignore" }))
    const cancel = s.resolveArrival(1, true, 10)
    expect(cancel.padFrames).toBe(0)
    const noncancel = s.resolveArrival(1, false, 10)
    expect(noncancel.padFrames).toBe(0)
    expect(drainAll(s)).toEqual(["synthetic"])
  })
})
