// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EnrichedCharacter } from "#/types/character"
import type { SlotLoadout, Slots } from "#/types/loadout"
import type { TimelineEntry } from "#/types/timeline"
import type { ActionEvent } from "#/types/simulation-log"

import { runSimulation } from "./simulation"
import { dmgHit } from "./simulation.test-fixtures"

let testCharacters: EnrichedCharacter[] = []
vi.mock("./loadout/catalog", () => ({
  getCharacterById: (id: number) =>
    testCharacters.find((c) => c.id === id) ?? null,
  getEchoById: () => null,
}))
afterEach(() => {
  testCharacters = []
})

const lo: SlotLoadout = {
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
const slots: Slots = [1, 2, null]
const loadouts: [SlotLoadout, SlotLoadout, SlotLoadout] = [lo, lo, lo]

// One skill, two stages. A stage-level cooldown on `bolt`; `recast` carries none.
// 200-frame action time keeps the cursor predictable across recasts.
const stageCdChar: EnrichedCharacter = {
  id: 1,
  name: "Stagecd",
  element: "Fusion",
  weaponType: "Rectifier",
  rarity: "5",
  maxEnergy: 100,
  forteCap: 100,
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 10,
      name: "Bolt",
      type: "Resonance Skill",
      stages: [
        {
          name: "Bolt",
          key: "bolt",
          category: "Resonance Skill",
          newName: "Bolt",
          value: "100%",
          actionTime: 200,
          cooldown: 4,
          damage: [dmgHit(1, 0, 0, "Resonance Skill")],
        },
        {
          name: "Recast",
          key: "recast",
          category: "Resonance Skill",
          newName: "Recast",
          value: "100%",
          actionTime: 50,
          damage: [dmgHit(1, 0, 0, "Resonance Skill")],
        },
      ],
      damage: [],
    },
  ],
}
const BOLT = "char.stagecd.resonance-skill.bolt.bolt::resonance-skill"
const RECAST = "char.stagecd.resonance-skill.bolt.recast::resonance-skill"

// One skill carrying a skill-level cooldown shared across both its stages.
const skillCdChar: EnrichedCharacter = {
  ...stageCdChar,
  id: 1,
  name: "Skillcd",
  skills: [
    {
      id: 10,
      name: "Arc",
      type: "Resonance Skill",
      cooldown: 4,
      stages: [
        {
          name: "Arc",
          key: "arc",
          category: "Resonance Skill",
          newName: "Arc",
          value: "100%",
          actionTime: 200,
          damage: [dmgHit(1, 0, 0, "Resonance Skill")],
        },
        {
          name: "Sibling",
          key: "sibling",
          category: "Resonance Skill",
          newName: "Sibling",
          value: "100%",
          actionTime: 50,
          damage: [dmgHit(1, 0, 0, "Resonance Skill")],
        },
      ],
      damage: [],
    },
  ],
}
const ARC = "char.skillcd.resonance-skill.arc.arc::resonance-skill"
const SIBLING = "char.skillcd.resonance-skill.arc.sibling::resonance-skill"

// A `Stagecd` whose Bolt runs `actionTime` frames, for tuning the swap-back
// window against the cooldown pad.
const boltChar = (actionTime: number): EnrichedCharacter => ({
  ...stageCdChar,
  skills: [
    {
      ...stageCdChar.skills[0],
      stages: [
        { ...stageCdChar.skills[0].stages[0], actionTime },
        stageCdChar.skills[0].stages[1],
      ],
    },
  ],
})

// An on-field filler whose action benches the caster for a known frame count.
const filler = (actionTime: number): EnrichedCharacter => ({
  id: 2,
  name: "Filler",
  element: "Fusion",
  weaponType: "Sword",
  rarity: "5",
  maxEnergy: 100,
  forteCap: 100,
  stats: { base: { hp: 0, atk: 0, def: 0 }, max: { hp: 0, atk: 1000, def: 0 } },
  template: { weapon: "", echo: "", echoSet: "" },
  skillTreeBonuses: [],
  buffs: [],
  skills: [
    {
      id: 20,
      name: "Normal Attack",
      type: "Normal Attack",
      stages: [
        {
          name: "Stage 1",
          category: "Basic Attack",
          value: "100%",
          actionTime,
          damage: [dmgHit(1)],
        },
      ],
      damage: [],
    },
  ],
})
const FILLER_STAGE =
  "char.filler.basic-attack.normal-attack.stage-1::basic-attack"

const ent = (
  characterId: number,
  stageId: string,
  id: string,
): TimelineEntry => ({ id, characterId, stageId })

const actionFor = (log: ReturnType<typeof runSimulation>, id: string) =>
  log.find(
    (e): e is ActionEvent => e.kind === "action" && e.sourceEntryId === id,
  )

const run = (entries: TimelineEntry[]) =>
  runSimulation(entries, slots, loadouts, { reactionDelay: 0 })

describe("simulation — skill cooldown as a Padding Delay", () => {
  it("pads a recast within 1s of ready", () => {
    testCharacters = [stageCdChar]
    // Bolt @0 arms its stage timer; cursor → 200. Second Bolt at cursor 200 has
    // remaining 0 + 240 − 200 = 40 (≤ 60) ⇒ pads 40 to frame 240.
    const log = run([ent(1, BOLT, "a"), ent(1, BOLT, "b")])
    const second = actionFor(log, "b")
    expect(second?.frame).toBe(240)
    expect(second?.delayBreakdown?.wait).toBe(40)
  })

  it("free recast once the cooldown has elapsed", () => {
    testCharacters = [
      {
        ...stageCdChar,
        skills: [
          {
            ...stageCdChar.skills[0],
            stages: [
              { ...stageCdChar.skills[0].stages[0], actionTime: 240 },
              stageCdChar.skills[0].stages[1],
            ],
          },
        ],
      },
    ]
    // Bolt @0, cursor → 240. Second Bolt at 240 has remaining 0 ⇒ free cast.
    const log = run([ent(1, BOLT, "a"), ent(1, BOLT, "b")])
    const second = actionFor(log, "b")
    expect(second?.frame).toBe(240)
    expect(second?.delayBreakdown).toBeUndefined()
  })

  it("pads at the 60-frame boundary", () => {
    testCharacters = [
      {
        ...stageCdChar,
        skills: [
          {
            ...stageCdChar.skills[0],
            stages: [
              { ...stageCdChar.skills[0].stages[0], actionTime: 180 },
              stageCdChar.skills[0].stages[1],
            ],
          },
        ],
      },
    ]
    // Bolt @0, cursor → 180. Second Bolt at 180 has remaining 60 (= window) ⇒ pads.
    const log = run([ent(1, BOLT, "a"), ent(1, BOLT, "b")])
    const second = actionFor(log, "b")
    expect(second?.frame).toBe(240)
    expect(second?.delayBreakdown?.wait).toBe(60)
  })

  it("does not pad a cast placed more than 1s before ready", () => {
    testCharacters = [
      {
        ...stageCdChar,
        skills: [
          {
            ...stageCdChar.skills[0],
            stages: [
              { ...stageCdChar.skills[0].stages[0], actionTime: 100 },
              stageCdChar.skills[0].stages[1],
            ],
          },
        ],
      },
    ]
    // Bolt @0, cursor → 100. Second Bolt at 100 has remaining 140 (> 60) ⇒ no pad,
    // cast fires at its authored start.
    const log = run([ent(1, BOLT, "a"), ent(1, BOLT, "b")])
    const second = actionFor(log, "b")
    expect(second?.frame).toBe(100)
    expect(second?.delayBreakdown).toBeUndefined()
  })

  it("skill-level cooldown pools across sibling stages", () => {
    testCharacters = [skillCdChar]
    // Arc @0 arms the shared skill timer; cursor → 200. The sibling stage at 200
    // reads the same timer ⇒ remaining 40 ⇒ pads to frame 240.
    const log = run([ent(1, ARC, "a"), ent(1, SIBLING, "s")])
    const sibling = actionFor(log, "s")
    expect(sibling?.frame).toBe(240)
    expect(sibling?.delayBreakdown?.wait).toBe(40)
  })

  it("stage-level cooldown stays independent across stages", () => {
    testCharacters = [stageCdChar]
    // Bolt arms only its own stage timer; Recast keys a different stage with no
    // cooldown ⇒ no pad, fires at the cursor.
    const log = run([ent(1, BOLT, "a"), ent(1, RECAST, "r")])
    const recast = actionFor(log, "r")
    expect(recast?.frame).toBe(200)
    expect(recast?.delayBreakdown).toBeUndefined()
  })

  it("cooldown pad wins the max over a shorter swap-back", () => {
    testCharacters = [boltChar(170), filler(20)]
    // Bolt @0 (cursor → 170). Filler benches the caster 20 frames; recast at
    // cursor 190 sees cooldown remaining 50 and swap-back 40 ⇒ max 50 to frame 240.
    const log = run([
      ent(1, BOLT, "a"),
      ent(2, FILLER_STAGE, "x"),
      ent(1, BOLT, "b"),
    ])
    const second = actionFor(log, "b")
    expect(second?.frame).toBe(240)
    expect(second?.delayBreakdown?.wait).toBe(50)
  })

  it("swap-back wins the max over a shorter cooldown pad", () => {
    testCharacters = [boltChar(200), filler(20)]
    // Bolt @0 (cursor → 200). Recast at cursor 220 sees cooldown remaining 20 and
    // swap-back 40 ⇒ max 40 to frame 260.
    const log = run([
      ent(1, BOLT, "a"),
      ent(2, FILLER_STAGE, "x"),
      ent(1, BOLT, "b"),
    ])
    const second = actionFor(log, "b")
    expect(second?.frame).toBe(260)
    expect(second?.delayBreakdown?.wait).toBe(40)
  })
})
