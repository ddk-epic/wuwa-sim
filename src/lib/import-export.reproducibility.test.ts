import { describe, expect, it, vi } from "vitest"
import { flattenNodes } from "#/types/timeline"
import { DEFAULT_SETTINGS } from "#/lib/settings"
import type { ImportExportPayload } from "#/lib/import-export"
import type { EnrichedCharacter } from "#/types/character"

// One synthetic character drives both the codec (via #/data) and the engine (via
// the catalog). Defined in vi.hoisted so the #/data mock can return it at the
// module-load that computes the codec's stage tables.
const { char } = vi.hoisted((): { char: EnrichedCharacter } => ({
  char: {
    id: 1,
    name: "Repro",
    element: "Fusion",
    weaponType: "Sword",
    rarity: "5",
    maxEnergy: 100,
    stats: {
      base: { hp: 0, atk: 0, def: 0 },
      max: { hp: 0, atk: 1000, def: 0 },
    },
    template: { weapon: "", echo: "", echoSet: "" },
    skillTreeBonuses: [],
    buffs: [],
    skills: [
      {
        id: 10,
        name: "Normal Attack",
        type: "Normal Attack",
        stages: [
          {
            name: "Stage 1",
            category: "Basic Attack",
            value: "100%",
            actionTime: 60,
            damage: [
              {
                type: "Basic Attack",
                dmgType: "Fusion",
                scalingStat: "atk",
                actionFrame: 0,
                value: 1.5,
                energy: 5,
                concerto: 0,
                toughness: 0,
                weakness: 0,
              },
            ],
          },
        ],
        damage: [],
      },
    ],
  },
}))

vi.mock("#/data/characters", () => ({ ALL_CHARACTERS: [char] }))
vi.mock("#/data/weapons", () => ({ ALL_WEAPONS: [] }))
vi.mock("#/data/echoes", () => ({ ALL_ECHOES: [] }))
vi.mock("#/data/echo-sets", () => ({ ALL_ECHO_SETS: [] }))
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) => (id === char.id ? char : null),
  getEchoById: () => null,
}))

const { encodePayload, decodePayload } = await import("#/lib/import-export")
const { compileCharacter } = await import("#/lib/compile-character")
const { runSimulation } = await import("./simulation")

function emptyLoadout() {
  return {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1" as const,
    cost4Mains: ["cd" as const],
    cost3Mains: ["elemDmg" as const, "elemDmg" as const],
  }
}

const STAGE_ID = [...compileCharacter(char).stageIndex.keys()][0]

function payloadWith(
  settings: ImportExportPayload["team"]["settings"],
): ImportExportPayload {
  return {
    team: {
      name: "Repro",
      slots: [char.id, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: char.id,
      settings,
    },
    timeline: [
      { kind: "entry", id: "e1", characterId: char.id, stageId: STAGE_ID },
    ],
  }
}

type Settings = NonNullable<ImportExportPayload["team"]["settings"]>

/** Run the team's timeline under an explicit settings set (decode regenerates
 * entry ids, so the comparison must hold the entries fixed and vary only the
 * settings). */
function simulate(p: ImportExportPayload, s: Settings) {
  return runSimulation(
    flattenNodes(p.timeline ?? []),
    p.team.slots,
    p.team.loadouts,
    s.reactionDelay,
    s.swapFrames,
    s.variantFloor,
    s.fallFrames,
    s.startWithFullEnergy,
  )
}

describe("share-code reproducibility", () => {
  it("decoded settings reproduce the source team's simulation output", () => {
    const sourceSettings: Settings = {
      reactionDelay: 12,
      swapFrames: 9,
      variantFloor: 0,
      fallFrames: 30,
      startWithFullEnergy: true,
    }
    const decoded = decodePayload(encodePayload(payloadWith(sourceSettings)))

    expect(simulate(decoded, decoded.team.settings!)).toEqual(
      simulate(decoded, sourceSettings),
    )
  })

  it("the shared settings actually change output (guards against a no-op test)", () => {
    const decoded = decodePayload(
      encodePayload(
        payloadWith({ ...DEFAULT_SETTINGS, startWithFullEnergy: true }),
      ),
    )

    expect(simulate(decoded, decoded.team.settings!)).not.toEqual(
      simulate(decoded, DEFAULT_SETTINGS),
    )
  })
})
