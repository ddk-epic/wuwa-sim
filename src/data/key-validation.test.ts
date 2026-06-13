import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ALL_CHARACTERS } from "#/data/characters"
import { ALL_ECHOES } from "#/data/echoes"
import { compileCharacter, compileEcho } from "#/lib/compile-character"
import { toKebab } from "#/lib/stage"

const KEY_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

describe("key validation", () => {
  it("compiles every character and echo without throwing", () => {
    for (const c of ALL_CHARACTERS)
      expect(() => compileCharacter(c)).not.toThrow()
    for (const e of ALL_ECHOES) expect(() => compileEcho(e)).not.toThrow()
  })

  it("throws when liberation resonanceCost disagrees with maxEnergy", () => {
    const withCost = ALL_CHARACTERS.find((c) =>
      c.skills.some((s) => s.resonanceCost !== undefined),
    )
    expect(withCost).toBeDefined()
    const drifted = { ...withCost!, maxEnergy: withCost!.maxEnergy + 1 }
    expect(() => compileCharacter(drifted)).toThrow(/disagrees with maxEnergy/)
  })

  it("character and echo slugs are globally unique and well-formed", () => {
    const slugs = [
      ...ALL_CHARACTERS.map((c) => toKebab(c.name)),
      ...ALL_ECHOES.map((e) => toKebab(e.name)),
    ]
    for (const slug of slugs) expect(slug).toMatch(KEY_RE)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("buff keys are unique within a character and well-formed", () => {
    for (const c of ALL_CHARACTERS) {
      const keys = [...compileCharacter(c).buffKeys.keys()]
      for (const key of keys) expect(key).toMatch(KEY_RE)
    }
  })
})

describe("authored data uses the token grammar (no lineage strings)", () => {
  const dirs = ["src/data/characters", "src/data/echoes"]
  const files = dirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => join(dir, f)),
  )

  const forbidden: [RegExp, string][] = [
    [
      /::(basic-attack|heavy-attack|resonance|intro|outro|echo|movement)/,
      "lineage `::type` descriptor",
    ],
    [/\bstageId:/, "`stageId:` (use `stage:`)"],
    [
      /\brequiresPriorStageId:/,
      "`requiresPriorStageId:` (use `requiresPriorStage:`)",
    ],
    [/\bbuffId:/, "`buffId:` (use `buff:`)"],
    [/\bsourceBuffId:/, "`sourceBuffId:` (use `sourceBuff:`)"],
  ]

  it.each(files)("%s holds no hand-written lineage references", (file) => {
    const src = readFileSync(file, "utf8")
    for (const [re, label] of forbidden) {
      expect(src, `${file} contains ${label}`).not.toMatch(re)
    }
  })
})
