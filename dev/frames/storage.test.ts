import { beforeEach, describe, expect, it } from "vitest"
import { loadClips, saveClips } from "./storage"
import type { Clip } from "./types"

const clip = (id: string): Clip => ({
  id,
  name: id,
  start: 0,
  end: 60,
  stageRefs: [],
  boundaries: [],
  hits: [],
})

describe("clip storage", () => {
  beforeEach(() => window.localStorage.clear())

  it("round-trips a character's clips", () => {
    const clips = [clip("a"), clip("b")]
    saveClips("Sanhua", clips)
    expect(loadClips("Sanhua")).toEqual(clips)
  })

  it("keys per character so they don't bleed across", () => {
    saveClips("Sanhua", [clip("s")])
    saveClips("Encore", [clip("e")])
    expect(loadClips("Sanhua").map((c) => c.id)).toEqual(["s"])
    expect(loadClips("Encore").map((c) => c.id)).toEqual(["e"])
  })

  it("returns an empty list for an unseen character", () => {
    expect(loadClips("Verina")).toEqual([])
  })
})
