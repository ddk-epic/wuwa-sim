import { describe, expect, it } from "vitest"
import { diffHunks } from "./diff"

describe("diffHunks", () => {
  it("returns no hunks for identical text", () => {
    expect(diffHunks("a\nb\nc", "a\nb\nc")).toEqual([])
  })

  it("pairs a single-line change as a del/add row with context around it", () => {
    const before = "a\nb\nold\nd\ne"
    const after = "a\nb\nnew\nd\ne"
    const [hunk, ...rest] = diffHunks(before, after, 1)
    expect(rest).toHaveLength(0)
    const changed = hunk.rows.find((r) => r.changed)!
    expect(changed.left?.text).toBe("old")
    expect(changed.right?.text).toBe("new")
    // One line of context on each side, by the requested window.
    expect(hunk.rows.map((r) => r.left?.text)).toEqual(["b", "old", "d"])
  })

  it("carries the correct line numbers when an addition shifts the right side", () => {
    const before = "a\nb\nc"
    const after = "a\nINS\nb\nc"
    const [hunk] = diffHunks(before, after, 3)
    const added = hunk.rows.find((r) => !r.left && r.right)!
    expect(added.right).toEqual({ n: 2, text: "INS" })
    const c = hunk.rows.find((r) => r.left?.text === "c")!
    expect(c.left?.n).toBe(3)
    expect(c.right?.n).toBe(4)
  })

  it("splits distant changes into separate hunks", () => {
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n")
    const after = before.replace("line 1", "X").replace("line 18", "Y")
    expect(diffHunks(before, after, 2).length).toBe(2)
  })
})
