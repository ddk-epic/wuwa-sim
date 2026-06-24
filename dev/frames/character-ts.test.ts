import { describe, expect, it } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import { characterToTs } from "./character-ts"

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

  it("wraps the literal in the import + `satisfies` binding", () => {
    const ts = characterToTs(character())
    expect(
      ts.startsWith(
        'import type { EnrichedCharacter } from "#/types/character"\n',
      ),
    ).toBe(true)
    expect(ts).toContain("export const infernoRider = ")
    expect(ts.trimEnd().endsWith("satisfies EnrichedCharacter")).toBe(true)
  })

  it("drops the injected Movement skill", () => {
    const ts = characterToTs(character())
    expect(ts).not.toContain("Dodge")
    expect(ts).not.toContain("Movement")
  })
})
