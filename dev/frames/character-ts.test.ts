// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import { characterToTs, forcedBreaks, toTsLiteral } from "./character-ts"

// One character exercising every layout rule: a Movement skill (dropped), a
// skill with stages (always breaks) carrying a `variants` map (always breaks)
// and a width-fitting inline damage entry, plus a 3-key buff (the buffs-section
// break threshold).
function character(): EnrichedCharacter {
  return {
    name: "Inferno Rider",
    maxEnergy: 100,
    skills: [
      { name: "Dodge", type: "Movement", stages: [] },
      {
        name: "Atk",
        type: "Basic Attack",
        stages: [
          {
            name: "A",
            actionTime: 12,
            variants: { cancel: { actionTime: 3 } },
            damage: [{ actionFrame: 0, value: 1 }],
          },
        ],
      },
    ],
    buffs: [{ id: "b1", critRate: 1, critDmg: 2, stacks: 3 }],
  } as unknown as EnrichedCharacter
}

describe("characterToTs", () => {
  it("renders the prettier-matching paste-ready layout", () => {
    expect(characterToTs(character())).toMatchInlineSnapshot(`
      "import type { EnrichedCharacter } from "#/types/character"

      export const infernoRider = {
        name: "Inferno Rider",
        maxEnergy: 100,
        skills: [
          {
            name: "Atk",
            type: "Basic Attack",
            stages: [
              {
                name: "A",
                actionTime: 12,
                variants: {
                  cancel: { actionTime: 3 },
                },
                damage: [{ actionFrame: 0, value: 1 }],
              },
            ],
          },
        ],
        buffs: [
          {
            id: "b1",
            critRate: 1,
            critDmg: 2,
            stacks: 3,
          },
        ],
      } satisfies EnrichedCharacter
      "
    `)
  })
})

describe("forcedBreaks — the break policy", () => {
  it("forces a skill object (has `stages`)", () => {
    const skill = { name: "s", stages: [] }
    expect(forcedBreaks(skill).has(skill)).toBe(true)
  })

  it("forces a non-empty `variants` map and propagates to its ancestor", () => {
    const stage = { name: "a", variants: { cancel: { actionTime: 1 } } }
    const forced = forcedBreaks(stage)
    expect(forced.has(stage.variants)).toBe(true)
    expect(forced.has(stage)).toBe(true)
    // A small, non-schema child still inlines.
    expect(forced.has(stage.variants.cancel)).toBe(false)
  })

  it("leaves an empty `variants` map unforced", () => {
    const stage = { name: "a", variants: {} }
    expect(forcedBreaks(stage).has(stage)).toBe(false)
  })

  it("forces a `buffs`-section object at 3 keys and propagates to the root", () => {
    const root = { buffs: [{ a: 1, b: 2, c: 3 }] }
    const forced = forcedBreaks(root)
    expect(forced.has(root.buffs[0])).toBe(true)
    expect(forced.has(root.buffs)).toBe(true)
    expect(forced.has(root)).toBe(true)
  })

  it("leaves a 2-key `buffs` object unforced", () => {
    const root = { buffs: [{ a: 1, b: 2 }] }
    expect(forcedBreaks(root).has(root.buffs[0])).toBe(false)
  })

  it("only applies the 3-key rule under `buffs`", () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(forcedBreaks(obj).has(obj)).toBe(false)
  })
})

describe("toTsLiteral — the generic width printer", () => {
  const none = new WeakSet<object>()

  it("inlines a container that fits the print width", () => {
    expect(toTsLiteral({ a: 1, b: 2 }, "", 0, none)).toBe("{ a: 1, b: 2 }")
  })

  it("breaks a container that overflows, one entry per line with trailing commas", () => {
    const big = "y".repeat(90)
    expect(toTsLiteral({ name: big }, "", 0, none)).toBe(
      `{\n  name: ${JSON.stringify(big)},\n}`,
    )
  })

  it("breaks a forced container even when it would fit the width", () => {
    const small = { a: 1 }
    const forced = new WeakSet<object>([small])
    expect(toTsLiteral(small, "", 0, forced)).toBe("{\n  a: 1,\n}")
  })

  it("quotes non-identifier keys and leaves identifiers bare", () => {
    expect(toTsLiteral({ "foo-bar": 1, foo: 2 }, "", 0, none)).toBe(
      '{ "foo-bar": 1, foo: 2 }',
    )
  })

  it("indents nested breaks by two spaces", () => {
    const big = "y".repeat(90)
    expect(toTsLiteral({ outer: { inner: big } }, "", 0, none)).toBe(
      `{\n  outer: {\n    inner: ${JSON.stringify(big)},\n  },\n}`,
    )
  })
})
