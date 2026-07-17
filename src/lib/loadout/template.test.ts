// @vitest-environment node
import { describe, expect, it } from "vitest"
import { loadoutFromTemplate, inferEchoSetForEcho } from "./template"
import { getCharacterById } from "./catalog"

describe("template — loadoutFromTemplate", () => {
  it("resolves Encore's Template to Stringmaster + Inferno Rider + Molten Rift (5pc)", () => {
    const encore = getCharacterById(1203)
    expect(encore).not.toBeNull()
    if (!encore) return
    expect(loadoutFromTemplate(encore.template)).toEqual({
      weaponId: 21050016,
      weaponRank: 1,
      echoId: 390080007,
      echoSetSlot1Id: 2,
      echoSetSlot2Id: 2,
      sequence: 0,
      echoBuild: "4-3-3-1-1",
      cost4Mains: ["cd"],
      cost3Mains: ["elemDmg", "elemDmg"],
    })
  })

  it("returns null weaponId when the Template's weapon name is unknown", () => {
    expect(
      loadoutFromTemplate({
        weapon: "Nonexistent Weapon",
        echo: "Inferno Rider",
        echoSet: "Molten Rift",
      }),
    ).toEqual({
      weaponId: null,
      weaponRank: 1,
      echoId: 390080007,
      echoSetSlot1Id: 2,
      echoSetSlot2Id: 2,
      sequence: 0,
      echoBuild: "4-3-3-1-1",
      cost4Mains: ["cd"],
      cost3Mains: ["elemDmg", "elemDmg"],
    })
  })
})

describe("template — inferEchoSetForEcho", () => {
  it("returns the EchoSet that the Echo belongs to", () => {
    const set = inferEchoSetForEcho(390080007) // Inferno Rider → Molten Rift
    expect(set).not.toBeNull()
    expect(set?.id).toBe(2)
    expect(set?.name).toBe("Molten Rift")
  })
})
