// @vitest-environment node
import { describe, expect, it } from "vitest"
import { PoolStore } from "./pool-store"

describe("PoolStore", () => {
  it("spawn pushes a member and tracks the count per character", () => {
    const pool = new PoolStore()
    expect(pool.count(1)).toBe(0)
    pool.spawn(1, 0, 100)
    pool.spawn(1, 0, 100)
    pool.spawn(2, 5, 60)
    expect(pool.count(1)).toBe(2)
    expect(pool.count(2)).toBe(1)
  })

  it("assigns monotonic handles and records spawn/maturation frames", () => {
    const pool = new PoolStore()
    const a = pool.spawn(1, 0, 100)
    const b = pool.spawn(1, 10, 110)
    expect(a.id).not.toBe(b.id)
    expect(b.id).toBeGreaterThan(a.id)
    expect(a.spawnFrame).toBe(0)
    expect(a.maturationFrame).toBe(100)
  })

  it("remove drops a member by handle and decrements the count", () => {
    const pool = new PoolStore()
    const a = pool.spawn(1, 0, 100)
    const b = pool.spawn(1, 0, 100)
    expect(pool.remove(1, a.id)).toBe(true)
    expect(pool.count(1)).toBe(1)
    expect(pool.remove(1, b.id)).toBe(true)
    expect(pool.count(1)).toBe(0)
  })

  it("remove returns false for an already-converted member", () => {
    const pool = new PoolStore()
    const a = pool.spawn(1, 0, 100)
    pool.remove(1, a.id)
    expect(pool.remove(1, a.id)).toBe(false)
    expect(pool.remove(1, 999)).toBe(false)
  })

  it("displaceOldest pops the oldest members down to cap, oldest-first", () => {
    const pool = new PoolStore()
    const a = pool.spawn(1, 0, 100)
    const b = pool.spawn(1, 10, 110)
    const c = pool.spawn(1, 20, 120)
    const displaced = pool.displaceOldest(1, 1)
    expect(displaced.map((m) => m.id)).toEqual([a.id, b.id])
    expect(pool.count(1)).toBe(1)
    expect(pool.remove(1, c.id)).toBe(true)
  })

  it("displaceOldest is a no-op at or under cap", () => {
    const pool = new PoolStore()
    pool.spawn(1, 0, 100)
    expect(pool.displaceOldest(1, 2)).toEqual([])
    expect(pool.displaceOldest(1, 1)).toEqual([])
    expect(pool.displaceOldest(2, 0)).toEqual([])
    expect(pool.count(1)).toBe(1)
  })

  it("clear empties every pool and resets handles", () => {
    const pool = new PoolStore()
    pool.spawn(1, 0, 100)
    pool.clear()
    expect(pool.count(1)).toBe(0)
    expect(pool.spawn(1, 0, 100).id).toBe(1)
  })
})
