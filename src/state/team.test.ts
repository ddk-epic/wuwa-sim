// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { createStore } from "jotai"
import {
  teamAtom,
  slotsAtom,
  focusedIdAtom,
  nameAtom,
  settingsAtom,
  toggleCharacterAtom,
  focusCharacterAtom,
  setOriginIdAtom,
  loadTeamAtom,
  coerceStoredActiveTeam,
  defaultActiveTeam,
  draftActiveTeam,
} from "./team"
import { loadoutFromTemplate, emptyLoadout } from "#/lib/loadout/template"
import { getCharacterById } from "#/lib/loadout/catalog"
import { DEFAULT_SETTINGS } from "#/lib/settings"

describe("teamAtom — composition writes", () => {
  it("toggleCharacter populates the slot loadout from the character template", () => {
    const store = createStore()
    store.set(toggleCharacterAtom, 1203) // Encore
    const encore = getCharacterById(1203)!
    expect(store.get(teamAtom).loadouts[0]).toEqual(
      loadoutFromTemplate(encore.template),
    )
  })

  it("focusCharacter sets focusedId", () => {
    const store = createStore()
    store.set(focusCharacterAtom, 1)
    expect(store.get(teamAtom).focusedId).toBe(1)
  })

  it("nameAtom reads and writes the team name", () => {
    const store = createStore()
    store.set(nameAtom, "Rover Hypercarry")
    expect(store.get(nameAtom)).toBe("Rover Hypercarry")
    expect(store.get(teamAtom).name).toBe("Rover Hypercarry")
  })
})

describe("slotsAtom", () => {
  it("reads the slots slice", () => {
    const store = createStore()
    store.set(toggleCharacterAtom, 1203)
    expect(store.get(slotsAtom)).toBe(store.get(teamAtom).slots)
  })

  it("preserves the slots reference across name/settings/focus changes", () => {
    const store = createStore()
    const before = store.get(slotsAtom)
    store.set(nameAtom, "Renamed")
    store.set(settingsAtom, { reactionDelay: 30 })
    store.set(focusCharacterAtom, 1203)
    expect(store.get(slotsAtom)).toBe(before)
  })
})

describe("focusedIdAtom", () => {
  it("reads the focusedId slice", () => {
    const store = createStore()
    store.set(focusCharacterAtom, 1203)
    expect(store.get(focusedIdAtom)).toBe(1203)
  })

  it("does not change on unrelated name/settings edits", () => {
    const store = createStore()
    store.set(focusCharacterAtom, 1203)
    store.set(nameAtom, "Renamed")
    store.set(settingsAtom, { reactionDelay: 30 })
    expect(store.get(focusedIdAtom)).toBe(1203)
  })
})

describe("settingsAtom", () => {
  it("patches a frame knob and clamps", () => {
    const store = createStore()
    store.set(settingsAtom, { reactionDelay: 99 })
    expect(store.get(settingsAtom).reactionDelay).toBe(60)
    expect(store.get(settingsAtom).swapFrames).toBe(DEFAULT_SETTINGS.swapFrames)
  })
})

describe("loadTeamAtom", () => {
  it("replaces the composition, clears the Origin, and coerces settings", () => {
    const store = createStore()
    store.set(setOriginIdAtom, "lib-1")
    store.set(loadTeamAtom, {
      slots: [1203, null, null],
      loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
      focusedId: 1203,
    })
    const team = store.get(teamAtom)
    expect(team.slots).toEqual([1203, null, null])
    expect(team.originId).toBeNull()
    expect(team.settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe("coerceStoredActiveTeam", () => {
  it("merges loadouts over defaults from a partial stored object", () => {
    const team = coerceStoredActiveTeam({
      name: "Partial",
      slots: [1203, null, null],
      loadouts: [{ sequence: 6 }],
      focusedId: 1203,
    })
    expect(team.name).toBe("Partial")
    expect(team.loadouts[0].sequence).toBe(6)
    expect(team.loadouts[0].weaponId).toBeNull()
    expect(team.loadouts[1].sequence).toBe(0)
  })

  it("a stored team lacking settings coerces to the defaults", () => {
    const team = coerceStoredActiveTeam({ name: "Legacy", slots: [1203] })
    expect(team.settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe("draftActiveTeam", () => {
  it("starts unnamed so the create modal's placeholder shows", () => {
    expect(draftActiveTeam().name).toBe("")
    expect(defaultActiveTeam().name).toBe("New team")
  })
})
