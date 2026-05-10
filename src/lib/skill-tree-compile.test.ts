import { describe, expect, it } from "vitest"
import { compileSkillTreeNode } from "./engine-bootstrap"

const ctx = { characterId: 1, characterElement: "Fusion" }

describe("compileSkillTreeNode — HP/DEF mapping", () => {
  it.each([
    ["HP", "hpPct"],
    ["DEF", "defPct"],
  ])("%s node compiles to { stat: %s } at 0.12", (node, stat) => {
    const def = compileSkillTreeNode(node, ctx)
    expect(def).not.toBeNull()
    const effect = def!.effects[0]
    expect(effect.kind).toBe("stat")
    if (effect.kind !== "stat") return
    expect(effect.path).toEqual({ stat })
    expect(effect.value).toEqual({ kind: "const", v: 0.12 })
  })
})
