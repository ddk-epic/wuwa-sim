import { describe, expect, it } from "vitest"
import {
  emptyLoadout,
  loadoutFromTemplate,
  inferEchoSetForEcho,
} from "./template"
import { getCharacterById } from "./catalog"

describe("template — emptyLoadout", () => {
  it("returns a Loadout with all ids null", () => {
    expect(emptyLoadout()).toEqual({
      weaponId: null,
      echoId: null,
      echoSetId: null,
    })
  })
})

describe("template — loadoutFromTemplate", () => {
  it("resolves Encore's Template to Stringmaster + Inferno Rider + Molten Rift", () => {
    const encore = getCharacterById(1203)
    expect(encore).not.toBeNull()
    if (!encore) return
    expect(loadoutFromTemplate(encore.template)).toEqual({
      weaponId: 21050016,
      echoId: 390080007,
      echoSetId: 2,
    })
  })

  it("resolves Sanhua's Template to Emerald of Genesis + Impermanence Heron + Moonlit Clouds", () => {
    const sanhua = getCharacterById(1102)
    expect(sanhua).not.toBeNull()
    if (!sanhua) return
    expect(loadoutFromTemplate(sanhua.template)).toEqual({
      weaponId: 21020015,
      echoId: 6000052,
      echoSetId: 8,
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
      echoId: 390080007,
      echoSetId: 2,
    })
  })

  it("returns null echoId when the Template's echo name is unknown", () => {
    expect(
      loadoutFromTemplate({
        weapon: "Stringmaster",
        echo: "Nonexistent Echo",
        echoSet: "Molten Rift",
      }),
    ).toEqual({
      weaponId: 21050016,
      echoId: null,
      echoSetId: 2,
    })
  })

  it("returns null echoSetId when the Template's echoSet name is unknown", () => {
    expect(
      loadoutFromTemplate({
        weapon: "Stringmaster",
        echo: "Inferno Rider",
        echoSet: "Nonexistent Set",
      }),
    ).toEqual({
      weaponId: 21050016,
      echoId: 390080007,
      echoSetId: null,
    })
  })

  it("returns all-null Loadout when every Template name is unknown", () => {
    expect(
      loadoutFromTemplate({
        weapon: "Nonexistent Weapon",
        echo: "Nonexistent Echo",
        echoSet: "Nonexistent Set",
      }),
    ).toEqual({
      weaponId: null,
      echoId: null,
      echoSetId: null,
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

  it("returns Moonlit Clouds for Impermanence Heron", () => {
    const set = inferEchoSetForEcho(6000052) // Impermanence Heron → Moonlit Clouds
    expect(set).not.toBeNull()
    expect(set?.id).toBe(8)
    expect(set?.name).toBe("Moonlit Clouds")
  })

  it("returns null when the Echo id is unknown", () => {
    expect(inferEchoSetForEcho(-1)).toBeNull()
  })
})
