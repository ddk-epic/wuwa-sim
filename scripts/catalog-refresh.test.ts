import { describe, expect, it } from "vitest"
import { characterCatalog, echoCatalog, setElements } from "./catalog-refresh"

describe("characterCatalog", () => {
  it("keeps only SSR and collapses same-name ids to the lowest", () => {
    const out = characterCatalog([
      {
        Id: 1310,
        Name: "Rover: Electro",
        QualityId: 5,
        Element: { Name: "Electro" },
        WeaponType: { Name: "Sword" },
      },
      {
        Id: 1309,
        Name: "Rover: Electro",
        QualityId: 5,
        Element: { Name: "Electro" },
        WeaponType: { Name: "Sword" },
      },
      {
        Id: 1402,
        Name: "Yangyang",
        QualityId: 4,
        Element: { Name: "Aero" },
        WeaponType: { Name: "Sword" },
      },
    ])
    expect(out).toEqual([
      {
        id: 1309,
        name: "Rover: Electro",
        element: "Electro",
        weaponType: "Sword",
      },
    ])
  })
})

describe("setElements", () => {
  it("returns both when two elements are named across pieces", () => {
    expect(
      setElements([
        { Key: 2, EffectDescription: "Energy Regen + {0}" },
        {
          Key: 5,
          EffectDescription:
            "Havoc Bane grants a bonus, Glacio Chafe grants another",
        },
      ]),
    ).toEqual(["Glacio", "Havoc"])
  })

  it("is neutral when no element is named", () => {
    expect(
      setElements([{ Key: 2, EffectDescription: "Energy Regen + {0}" }]),
    ).toEqual([])
  })
})

describe("echoCatalog", () => {
  const fleurdelys = {
    Id: 6000106,
    Name: "Reminiscence: Fleurdelys",
    Type: "Echo",
    FetterGroups: [
      {
        Id: 16,
        Name: "Gusts of Welkin",
        Fetters: [{ Key: 2, EffectDescription: "Aero DMG + {0}" }],
      },
      {
        Id: 17,
        Name: "Windward Pilgrimage",
        Fetters: [{ Key: 2, EffectDescription: "Aero DMG + {0}" }],
      },
    ],
  }

  it("attaches cost and per-set elements to a main-slot echo", () => {
    const out = echoCatalog([fleurdelys], new Map([[6000106, 4]]))
    expect(out).toEqual([
      {
        id: 6000106,
        name: "Reminiscence: Fleurdelys",
        cost: 4,
        sets: [
          { name: "Gusts of Welkin", elements: ["Aero"] },
          { name: "Windward Pilgrimage", elements: ["Aero"] },
        ],
      },
    ])
  })

  it("drops cost-1, unknown-cost, phantom-appearance, and Phantom-prefixed echoes", () => {
    const out = echoCatalog(
      [
        fleurdelys,
        { Id: 1, Name: "Trash", Type: "Echo", FetterGroups: [] },
        { Id: 2, Name: "Uncosted", Type: "Echo", FetterGroups: [] },
        { Id: 3, Name: "Skin", Type: "Phantom Appearance", FetterGroups: [] },
        { Id: 4, Name: "Phantom: Dreamless", Type: "Echo", FetterGroups: [] },
      ],
      new Map([
        [6000106, 4],
        [1, 1],
        [4, 4],
      ]),
    )
    expect(out.map((e) => e.id)).toEqual([6000106])
  })
})
