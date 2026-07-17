// @vitest-environment node
import { describe, expect, it } from "vitest"
import { cartethyia } from "#/data/characters/cartethyia"
import { shorekeeper } from "#/data/characters/shorekeeper"
import {
  ECHO_BUILD_LIST,
  ECHO_BUILDS,
  scalingStatFromSkillTree,
} from "./echo-stat-constants"

describe("ECHO_BUILDS presets", () => {
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
})

describe("scalingStatFromSkillTree", () => {
  it("reads HP scalers off their skill-tree base-stat node", () => {
    expect(scalingStatFromSkillTree(shorekeeper)).toBe("hp")
    expect(scalingStatFromSkillTree(cartethyia)).toBe("hp")
  })

  it("defaults to atk when no base-stat node is present", () => {
    expect(scalingStatFromSkillTree({ skillTreeBonuses: [] })).toBe("atk")
    expect(scalingStatFromSkillTree({ skillTreeBonuses: ["Crit. Rate"] })).toBe(
      "atk",
    )
  })
})
