import { describe, expect, it, vi } from "vitest"
import type { SlotLoadout } from "#/types/loadout"
import type { ImportExportPayload } from "#/lib/import-export"
import { encode as base91Encode, decode as base91Decode } from "#/lib/base91"

// Minimal stubs — only the fields the codec actually reads.
const CHAR_A = {
  id: 1102,
  name: "Sanhua",
  skills: [
    {
      name: "Normal Attack",
      stages: [
        { name: "Stage 1 DMG", category: "Basic Attack" },
        { name: "Stage 2 DMG", category: "Basic Attack" },
        { name: "Stage 3 DMG", category: "Basic Attack" },
      ],
    },
    {
      name: "Resonance Skill",
      stages: [{ name: "Skill DMG", category: "Resonance Skill" }],
    },
  ],
  buffs: [],
}
const CHAR_B = {
  id: 1203,
  name: "Encore",
  skills: [
    {
      name: "Heavy Attack",
      stages: [{ name: "Charge DMG", category: "Heavy Attack" }],
    },
  ],
  buffs: [],
}

const WEAPON_A = { id: 21020015 }
const ECHO_A = {
  id: 390080007,
  name: "Inferno Rider",
  skill: { stages: [{ name: "Tap" }, { name: "Hold" }] },
  buffs: [],
}
const ECHO_SET_A = { id: 2 }
const ECHO_SET_B = { id: 7 }

vi.mock("#/data/characters", () => ({ ALL_CHARACTERS: [CHAR_A, CHAR_B] }))
vi.mock("#/data/weapons", () => ({ ALL_WEAPONS: [WEAPON_A] }))
vi.mock("#/data/echoes", () => ({ ALL_ECHOES: [ECHO_A] }))
vi.mock("#/data/echo-sets", () => ({ ALL_ECHO_SETS: [ECHO_SET_A, ECHO_SET_B] }))

// Import after mocks are hoisted.
const { encodePayload, decodePayload } = await import("#/lib/import-export")

// ---- helpers ----
function emptyLoadout(): SlotLoadout {
  return {
    weaponId: null,
    weaponRank: 1,
    echoId: null,
    echoSetSlot1Id: null,
    echoSetSlot2Id: null,
    sequence: 0,
    echoBuild: "4-3-3-1-1",
    cost4Mains: ["cd"],
    cost3Mains: ["elemDmg", "elemDmg"],
  }
}

function basePayload(): ImportExportPayload {
  return {
    team: {
      name: "",
      slots: [CHAR_A.id, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: CHAR_A.id,
    },
    timeline: null,
  }
}

// ---- Base91 ----
describe("Base91 codec", () => {
  // Access the private functions indirectly: encode then decode a known payload
  // and verify the string contains only Base91 characters.
  const B91_RE = /^[A-Za-z0-9!#$%&()*+,./:;<=>?@[\]^_`{|}~"]*$/

  it("produces only Base91 characters", () => {
    const code = encodePayload(basePayload())
    expect(code).toMatch(B91_RE)
  })

  it("roundtrips arbitrary byte patterns via the payload codec", () => {
    // Encode then decode must give back the same payload.
    const payload = basePayload()
    expect(decodePayload(encodePayload(payload))).toMatchObject(payload)
  })
})

// ---- Team roundtrips ----
describe("team encoding", () => {
  it("roundtrips all-null slots and focusedId", () => {
    const payload = basePayload()
    payload.team.slots = [null, null, null]
    payload.team.focusedId = null
    expect(decodePayload(encodePayload(payload))).toMatchObject(payload)
  })

  it("roundtrips all three slots filled", () => {
    const payload = basePayload()
    payload.team.slots = [CHAR_A.id, CHAR_B.id, CHAR_A.id]
    payload.team.focusedId = CHAR_B.id
    expect(decodePayload(encodePayload(payload))).toMatchObject(payload)
  })

  it("roundtrips weapon fields", () => {
    const payload = basePayload()
    payload.team.loadouts[0] = {
      ...emptyLoadout(),
      weaponId: WEAPON_A.id,
      weaponRank: 5,
    }
    expect(decodePayload(encodePayload(payload))).toMatchObject(payload)
  })

  it("roundtrips echo and echo-set fields", () => {
    const payload = basePayload()
    payload.team.loadouts[0] = {
      ...emptyLoadout(),
      echoId: ECHO_A.id,
      echoSetSlot1Id: ECHO_SET_A.id,
      echoSetSlot2Id: ECHO_SET_B.id,
    }
    expect(decodePayload(encodePayload(payload))).toMatchObject(payload)
  })

  it("roundtrips echoBuild 4-4-1-1-1 with two cost4Mains", () => {
    const payload = basePayload()
    payload.team.loadouts[1] = {
      ...emptyLoadout(),
      echoBuild: "4-4-1-1-1",
      cost4Mains: ["cr", "scaling"],
      cost3Mains: [],
    }
    expect(decodePayload(encodePayload(payload))).toMatchObject(payload)
  })

  it("roundtrips sequence 0–6", () => {
    for (const seq of [0, 1, 3, 6]) {
      const payload = basePayload()
      payload.team.loadouts[0] = { ...emptyLoadout(), sequence: seq }
      expect(
        decodePayload(encodePayload(payload)).team.loadouts[0].sequence,
      ).toBe(seq)
    }
  })

  it("roundtrips the team name (VERSION 2)", () => {
    const payload = basePayload()
    payload.team.name = "Sanhua Hypercarry"
    expect(decodePayload(encodePayload(payload)).team.name).toBe(
      "Sanhua Hypercarry",
    )
  })

  it("roundtrips a unicode team name", () => {
    const payload = basePayload()
    payload.team.name = "凍結 ❄️ team"
    expect(decodePayload(encodePayload(payload)).team.name).toBe("凍結 ❄️ team")
  })

  it("decodes a v1 code (no name) with the name defaulting to empty string", () => {
    // A v2 encode of name="" is bytes [2, 0, …]; the equivalent v1 buffer is
    // [1, …rest] (no version-2 name byte). Reconstruct one and decode it.
    const payload = basePayload()
    payload.team.name = ""
    const v2Bytes = base91Decode(encodePayload(payload))
    const v1Bytes = new Uint8Array([1, ...v2Bytes.slice(2)])
    const decoded = decodePayload(base91Encode(v1Bytes))
    expect(decoded.team.name).toBe("")
    expect(decoded.team.slots).toEqual(payload.team.slots)
    expect(decoded.team.focusedId).toBe(payload.team.focusedId)
  })
})

// ---- Timeline roundtrips ----
describe("timeline encoding", () => {
  it("roundtrips null timeline", () => {
    const payload = { ...basePayload(), timeline: null }
    expect(decodePayload(encodePayload(payload)).timeline).toBeNull()
  })

  it("roundtrips empty timeline array", () => {
    const payload = { ...basePayload(), timeline: [] }
    expect(decodePayload(encodePayload(payload)).timeline).toEqual([])
  })

  it("roundtrips entry node — regenerates id, preserves all other fields", () => {
    const payload = {
      ...basePayload(),
      timeline: [
        {
          kind: "entry" as const,
          id: "original-id",
          characterId: CHAR_A.id,
          stageId:
            "char.sanhua.basic-attack.normal-attack.stage-1::basic-attack",
          variantKind: undefined,
        },
      ],
    }
    const decoded = decodePayload(encodePayload(payload))
    const entry = decoded.timeline![0]
    expect(entry.kind).toBe("entry")
    if (entry.kind === "entry") {
      expect(entry.id).not.toBe("original-id") // regenerated
      expect(entry.characterId).toBe(CHAR_A.id)
      expect(entry.stageId).toBe(
        "char.sanhua.basic-attack.normal-attack.stage-1::basic-attack",
      )
      expect(entry.variantKind).toBeUndefined()
    }
  })

  it("roundtrips variantKind — all three values", () => {
    for (const vk of ["cancel", "instantCancel", "swap"] as const) {
      const payload = {
        ...basePayload(),
        timeline: [
          {
            kind: "entry" as const,
            id: "x",
            characterId: CHAR_A.id,
            stageId:
              "char.sanhua.basic-attack.normal-attack.stage-2::basic-attack",
            variantKind: vk,
          },
        ],
      }
      const decoded = decodePayload(encodePayload(payload))
      expect(
        decoded.timeline![0].kind === "entry" &&
          decoded.timeline![0].variantKind,
      ).toBe(vk)
    }
  })

  it("roundtrips echo stageId", () => {
    const payload = {
      ...basePayload(),
      timeline: [
        {
          kind: "entry" as const,
          id: "y",
          characterId: CHAR_A.id,
          stageId: "echo.inferno-rider.tap::echo-skill",
          variantKind: undefined,
        },
      ],
    }
    const decoded = decodePayload(encodePayload(payload))
    expect(
      decoded.timeline![0].kind === "entry" && decoded.timeline![0].stageId,
    ).toBe("echo.inferno-rider.tap::echo-skill")
  })

  it("roundtrips group node — regenerates ids, preserves entries", () => {
    const payload = {
      ...basePayload(),
      timeline: [
        {
          kind: "group" as const,
          id: "group-original",
          label: "My Rotation",
          locked: true,
          entries: [
            {
              id: "entry-original",
              characterId: CHAR_B.id,
              stageId:
                "char.encore.heavy-attack.heavy-attack.charge::heavy-attack",
              variantKind: undefined,
            },
          ],
        },
      ],
    }
    const decoded = decodePayload(encodePayload(payload))
    const group = decoded.timeline![0]
    expect(group.kind).toBe("group")
    if (group.kind === "group") {
      expect(group.id).not.toBe("group-original")
      expect(group.label).toBe("My Rotation")
      expect(group.locked).toBe(true)
      expect(group.entries[0].id).not.toBe("entry-original")
      expect(group.entries[0].characterId).toBe(CHAR_B.id)
      expect(group.entries[0].stageId).toBe(
        "char.encore.heavy-attack.heavy-attack.charge::heavy-attack",
      )
    }
  })

  it("roundtrips mixed entry and group nodes", () => {
    const payload = {
      ...basePayload(),
      timeline: [
        {
          kind: "entry" as const,
          id: "e1",
          characterId: CHAR_A.id,
          stageId:
            "char.sanhua.basic-attack.normal-attack.stage-3::basic-attack",
          variantKind: undefined,
        },
        {
          kind: "group" as const,
          id: "g1",
          label: "Burst Window",
          locked: false,
          entries: [
            {
              id: "e2",
              characterId: CHAR_B.id,
              stageId:
                "char.encore.heavy-attack.heavy-attack.charge::heavy-attack",
              variantKind: undefined,
            },
          ],
        },
      ],
    }
    const decoded = decodePayload(encodePayload(payload))
    expect(decoded.timeline).toHaveLength(2)
    expect(decoded.timeline![0].kind).toBe("entry")
    expect(decoded.timeline![1].kind).toBe("group")
  })
})

// ---- Error cases ----
describe("error handling", () => {
  it("throws on invalid Base91 input", () => {
    expect(() => decodePayload("not valid !!!")).toThrow()
  })

  it("throws on an unsupported (too-new) format version", () => {
    // Craft a buffer whose version byte is 99 (neither v1 nor v2).
    const code = base91Encode(new Uint8Array([99, 0, 0xff]))
    expect(() => decodePayload(code)).toThrow(/version/i)
  })

  it("throws when encoding an unknown characterId", () => {
    const payload = basePayload()
    payload.team.slots[0] = 9999
    expect(() => encodePayload(payload)).toThrow(/Unknown character/)
  })

  it("throws when encoding an unknown weaponId", () => {
    const payload = basePayload()
    payload.team.loadouts[0] = { ...emptyLoadout(), weaponId: 9999 }
    expect(() => encodePayload(payload)).toThrow(/Unknown weapon/)
  })

  it("throws when encoding an unknown stageId", () => {
    const payload = {
      ...basePayload(),
      timeline: [
        {
          kind: "entry" as const,
          id: "x",
          characterId: CHAR_A.id,
          stageId: "Not A Real Stage::foo",
          variantKind: undefined,
        },
      ],
    }
    expect(() => encodePayload(payload)).toThrow(/Unknown stageId/)
  })
})
