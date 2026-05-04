import { describe, expect, it } from "vitest"
import { compileSkillTreeNode } from "./skill-tree-registry"

const ctx = { characterId: 1, characterElement: "Fusion" }

describe("compileSkillTreeNode — HP/DEF mapping", () => {
  it('HP node compiles to { stat: "hpPct" } at 0.12', () => {
    const def = compileSkillTreeNode("HP", ctx)
    expect(def).not.toBeNull()
    const effect = def!.effects[0]
    expect(effect.kind).toBe("stat")
    if (effect.kind !== "stat") return
    expect(effect.path).toEqual({ stat: "hpPct" })
    expect(effect.value).toEqual({ kind: "const", v: 0.12 })
  })

  it('DEF node compiles to { stat: "defPct" } at 0.12', () => {
    const def = compileSkillTreeNode("DEF", ctx)
    expect(def).not.toBeNull()
    const effect = def!.effects[0]
    expect(effect.kind).toBe("stat")
    if (effect.kind !== "stat") return
    expect(effect.path).toEqual({ stat: "defPct" })
    expect(effect.value).toEqual({ kind: "const", v: 0.12 })
  })
})
