import { describe, expect, it } from "vitest"
import {
  DEFAULT_ECHO_BUILD,
  ECHO_BUILD_LIST,
  ECHO_BUILDS,
} from "./echo-stat-constants"

describe("ECHO_BUILDS presets", () => {
  it("lists every preset key", () => {
    expect([...ECHO_BUILD_LIST].sort()).toEqual(Object.keys(ECHO_BUILDS).sort())
  })

  it("declares slot counts matching the preset name", () => {
    for (const build of ECHO_BUILD_LIST) {
      const costs = build.split("-").map(Number)
      const { cost4, cost3, cost1 } = ECHO_BUILDS[build]
      expect(cost4).toBe(costs.filter((c) => c === 4).length)
      expect(cost3).toBe(costs.filter((c) => c === 3).length)
      expect(cost1).toBe(costs.filter((c) => c === 1).length)
    }
  })

  // The share-code encoder writes exactly `cost4`/`cost3` mains per slot, so a
  // default longer than its capacity would corrupt the byte layout.
  it("sizes default mains to the slot capacity", () => {
    for (const build of ECHO_BUILD_LIST) {
      const { cost4, cost3, cost4Default, cost3Default } = ECHO_BUILDS[build]
      expect(cost4Default.length).toBe(cost4)
      expect(cost3Default.length).toBe(cost3)
    }
  })

  it("has a default build present in the record", () => {
    expect(ECHO_BUILDS[DEFAULT_ECHO_BUILD]).toBeDefined()
  })
})
