// @vitest-environment node
import { describe, expect, it } from "vitest"
import { getCharacterById } from "#/lib/loadout/catalog"
import { compileCharacter } from "#/lib/compile-character"
import type { StageInfo } from "#/lib/compile-character"
import type { TimelineNode } from "#/types/timeline"
import { rotationCards } from "./rotation-cards"

const SANHUA = 1102
const ENCORE = 1203
const CAMELLYA = 1603

function stageId(charId: number, match: (i: StageInfo) => boolean): string {
  const char = getCharacterById(charId)
  if (!char) throw new Error(`unknown character ${charId}`)
  for (const info of compileCharacter(char).stageIndex.values()) {
    if (match(info)) return info.stageId
  }
  throw new Error(`no matching stage for ${charId}`)
}

const byCategory = (c: string) => (i: StageInfo) => i.stage.category === c
const byGrouping = (g: string) => (i: StageInfo) => i.skill.type === g

let seq = 0
function entry(characterId: number, sid: string): TimelineNode {
  return { kind: "entry", id: `e${seq++}`, characterId, stageId: sid }
}

const sanhua = {
  intro: () => entry(SANHUA, stageId(SANHUA, byCategory("Intro Skill"))),
  basic: () => entry(SANHUA, stageId(SANHUA, byCategory("Basic Attack"))),
  skill: () => entry(SANHUA, stageId(SANHUA, byCategory("Resonance Skill"))),
  lib: () => entry(SANHUA, stageId(SANHUA, byCategory("Resonance Liberation"))),
  detonate: () => entry(SANHUA, stageId(SANHUA, byGrouping("Forte Circuit"))),
  outro: () => entry(SANHUA, stageId(SANHUA, byCategory("Outro Skill"))),
  dodge: () => entry(SANHUA, stageId(SANHUA, byCategory("Movement"))),
}

describe("rotationCards", () => {
  it("maps a stint to one card with the action legend, intro and outro consuming no letter", () => {
    const { opener } = rotationCards([
      sanhua.intro(),
      sanhua.basic(),
      sanhua.basic(),
      sanhua.skill(),
      sanhua.lib(),
      sanhua.detonate(),
      sanhua.outro(),
    ])
    expect(opener).toEqual([
      { characterId: SANHUA, letters: "AAERZ", hasIntro: true },
    ])
  })

  it("emits Z for any Forte Circuit stage regardless of category", () => {
    // Camellya's Ephemeral/Perennial are Forte Circuit grouping, Resonance category.
    const { opener } = rotationCards([
      entry(CAMELLYA, stageId(CAMELLYA, byGrouping("Forte Circuit"))),
    ])
    expect(opener).toEqual([
      { characterId: CAMELLYA, letters: "Z", hasIntro: false },
    ])
  })

  it("starts a new card at every swap", () => {
    const { opener } = rotationCards([
      sanhua.basic(),
      entry(ENCORE, stageId(ENCORE, byCategory("Basic Attack"))),
      sanhua.basic(),
    ])
    expect(opener.map((c) => c.characterId)).toEqual([SANHUA, ENCORE, SANHUA])
  })

  it("drops unmapped movement (dodge/jump) glyphs", () => {
    const { opener } = rotationCards([sanhua.basic(), sanhua.dodge()])
    expect(opener).toEqual([
      { characterId: SANHUA, letters: "A", hasIntro: false },
    ])
  })

  it("splits opener and loop at the loop marker", () => {
    const { opener, loop } = rotationCards([
      sanhua.basic(),
      { kind: "loopMarker", id: "lm" },
      sanhua.skill(),
    ])
    expect(opener).toEqual([
      { characterId: SANHUA, letters: "A", hasIntro: false },
    ])
    expect(loop).toEqual([
      { characterId: SANHUA, letters: "E", hasIntro: false },
    ])
  })
})
