import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { formatCharacter } from "./generate-character"
import { formatEcho } from "./generate-echo"
import { formatEchoSet } from "./generate-echo-set"
import { formatWeapon } from "./generate-weapon"
import type { EchoEntry } from "./lib/catalog"
import {
  characterPlaceholders,
  echoesForTier,
  hasEmptyBuffs,
  matchCharacters,
  parseArgs,
  patchTemplate,
  wireIntoIndex,
} from "./new-character"

const characters = [
  {
    id: 1409,
    name: "Cartethyia",
    element: "Aero" as const,
    weaponType: "Sword",
  },
  {
    id: 1502,
    name: "Rover: Spectro",
    element: "Spectro" as const,
    weaponType: "Sword",
  },
]

describe("matchCharacters", () => {
  it("matches a case-insensitive name fragment", () => {
    expect(matchCharacters(characters, "cart").map((c) => c.name)).toEqual([
      "Cartethyia",
    ])
  })
})

const echoes: EchoEntry[] = [
  {
    id: 1,
    name: "Locked Aero",
    cost: 4,
    sets: [{ name: "Windward Pilgrimage", elements: ["Aero"] }],
  },
  {
    id: 2,
    name: "Neutral Cost4",
    cost: 4,
    sets: [{ name: "Moonlit Clouds", elements: [] }],
  },
  {
    id: 3,
    name: "Off Element",
    cost: 4,
    sets: [{ name: "Void Thunder", elements: ["Electro"] }],
  },
  {
    id: 4,
    name: "Cheap",
    cost: 3,
    sets: [{ name: "Midnight Veil", elements: ["Havoc"] }],
  },
]

describe("echoesForTier", () => {
  it("locked keeps only cost-4 echoes with a set of the character's element", () => {
    expect(echoesForTier(echoes, "Aero", "locked").map((e) => e.id)).toEqual([
      1,
    ])
  })

  it("cost4 keeps every cost-4 echo including neutral and off-element", () => {
    expect(echoesForTier(echoes, "Aero", "cost4").map((e) => e.id)).toEqual([
      1, 2, 3,
    ])
  })

  it("cost3 keeps only 3-cost echoes", () => {
    expect(echoesForTier(echoes, "Aero", "cost3").map((e) => e.id)).toEqual([4])
  })
})

describe("wireIntoIndex", () => {
  const index = [
    'import type { WeaponData } from "#/types/weapon"',
    'import { emeraldOfGenesis } from "./emerald-of-genesis"',
    "",
    "export const ALL_WEAPONS: WeaponData[] = [",
    "  emeraldOfGenesis,",
    "]",
    "",
  ].join("\n")

  it("adds the import and array entry", () => {
    const out = wireIntoIndex(
      index,
      "defiersThorn",
      "./defiers-thorn",
      "ALL_WEAPONS",
    )
    expect(out).toContain('import { defiersThorn } from "./defiers-thorn"')
    expect(out).toMatch(/emeraldOfGenesis,\n {2}defiersThorn,\n\]/)
  })

  it("is a no-op when the binding is already wired", () => {
    const once = wireIntoIndex(
      index,
      "defiersThorn",
      "./defiers-thorn",
      "ALL_WEAPONS",
    )
    expect(
      wireIntoIndex(once, "defiersThorn", "./defiers-thorn", "ALL_WEAPONS"),
    ).toBe(once)
  })

  it("wires into an array with a trailing method call", () => {
    const mapped = [
      'import { encore } from "./encore"',
      "",
      "export const ALL_CHARACTERS: EnrichedCharacter[] = [",
      "  encore,",
      "].map(injectMovement)",
      "",
    ].join("\n")
    const out = wireIntoIndex(
      mapped,
      "cartethyia",
      "./cartethyia",
      "ALL_CHARACTERS",
    )
    expect(out).toMatch(/encore,\n {2}cartethyia,\n\]\.map\(injectMovement\)/)
  })
})

describe("patchTemplate", () => {
  const source = [
    "export const cartethyia = {",
    "  template: {",
    '    weapon: "",',
    '    echo: "",',
    '    echoSet: "",',
    "  },",
    "  buffs: [],",
    "}",
  ].join("\n")

  it("fills an empty template block", () => {
    const out = patchTemplate(source, {
      weapon: "Defier's Thorn",
      echo: "Reminiscence: Fleurdelys",
      echoSet: "Windward Pilgrimage",
    })
    expect(out).toContain('weapon: "Defier\'s Thorn",')
    expect(out).toContain('echoSet: "Windward Pilgrimage",')
  })

  it("overwrites an already-filled template block", () => {
    const filled = patchTemplate(source, {
      weapon: "A",
      echo: "B",
      echoSet: "C",
    })
    const out = patchTemplate(filled, {
      weapon: "X",
      echo: "Y",
      echoSet: "Z",
    })
    expect(out).toContain('weapon: "X",')
    expect(out).not.toContain('weapon: "A",')
  })

  it("refuses a source without exactly one template block", () => {
    expect(() =>
      patchTemplate("no template here", { weapon: "", echo: "", echoSet: "" }),
    ).toThrow(/exactly one template block/)
  })
})

describe("characterPlaceholders", () => {
  it("reports each generator placeholder left for a human", () => {
    const source = [
      "export const x = {",
      "  maxEnergy: 0,",
      "  forteCap: 100,",
      "  buffs: [],",
      "  skills: [",
      "    { actionTime: 0, },",
      "    { actionTime: 0, },",
      "  ],",
      "}",
    ].join("\n")
    expect(characterPlaceholders(source)).toEqual([
      "forteCap is 100 (default)",
      "maxEnergy is 0 (no liberation cost found)",
      "no buffs authored",
      "2 stages with actionTime: 0",
    ])
  })

  it("reports nothing once the placeholders are filled", () => {
    const source = [
      "export const x = {",
      "  maxEnergy: 125,",
      "  forteCap: 120,",
      "  buffs: [{ id: 1 }],",
      "  skills: [{ actionTime: 62, }],",
      "}",
    ].join("\n")
    expect(characterPlaceholders(source)).toEqual([])
  })
})

// Guards the scanners against generator drift: they match literal formatting,
// so a change to any formatX indentation would silently break the scan. Fed
// with real fixtures rather than hand-written strings.
const DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/data",
)
function rawFixture<T>(dir: string, slug: string): T {
  const file = path.join(DATA_DIR, dir, "raw", `${slug}.json`)
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T
}

describe("scanners match real generator output", () => {
  it("hasEmptyBuffs flags every freshly generated module", () => {
    expect(
      hasEmptyBuffs(formatWeapon(rawFixture("weapons", "defiers-thorn"), "w")),
    ).toBe(true)
    expect(
      hasEmptyBuffs(
        formatEcho(rawFixture("echoes", "reminiscence-fleurdelys"), "e"),
      ),
    ).toBe(true)
    expect(
      hasEmptyBuffs(formatEchoSet("two-five", "s", "windward-pilgrimage")),
    ).toBe(true)
  })

  it("characterPlaceholders flags the generator's character defaults", () => {
    const source = formatCharacter(
      rawFixture("characters", "cartethyia"),
      "cartethyia",
    )
    expect(characterPlaceholders(source)).toContain("forteCap is 100 (default)")
    expect(characterPlaceholders(source)).toContain("no buffs authored")
  })
})

describe("parseArgs", () => {
  it("splits positional fragment from value flags", () => {
    const flags = parseArgs(["rover", "spectro", "--weapon", "Defier's Thorn"])
    expect(flags.fragment).toBe("rover spectro")
    expect(flags.weapon).toBe("Defier's Thorn")
  })

  it("throws when a value flag is last with no value", () => {
    expect(() => parseArgs(["cartethyia", "--weapon"])).toThrow(
      /--weapon needs a value/,
    )
  })

  it("throws rather than swallowing the next flag as a value", () => {
    expect(() => parseArgs(["--weapon", "--echo", "Fleurdelys"])).toThrow(
      /--weapon needs a value/,
    )
  })
})
