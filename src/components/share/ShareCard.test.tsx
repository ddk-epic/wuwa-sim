// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { getCharacterById } from "#/lib/loadout/catalog"
import type { RotationCards } from "#/lib/share/rotation-cards"
import type { Slots } from "#/types/loadout"
import { ShareCard } from "./ShareCard"

const SANHUA = 1102
const ENCORE = 1203

afterEach(cleanup)

const cards: RotationCards = {
  opener: [
    { characterId: SANHUA, letters: "AAERZ", hasIntro: true },
    { characterId: ENCORE, letters: "A", hasIntro: false },
  ],
  loop: [],
}

describe("ShareCard", () => {
  it("renders the joined slot names as the title and the opener letter strings", () => {
    const slots: Slots = [SANHUA, ENCORE, null]
    render(<ShareCard cards={cards} slots={slots} />)

    const sanhua = getCharacterById(SANHUA)!.name
    const encore = getCharacterById(ENCORE)!.name
    expect(screen.getByText(`${sanhua} / ${encore}`)).toBeTruthy()
    expect(screen.getByText("Opener")).toBeTruthy()
    expect(screen.getByText("AAERZ")).toBeTruthy()
    expect(screen.getByText("A")).toBeTruthy()
  })

  it("renders an IN badge for an intro-led stint", () => {
    render(<ShareCard cards={cards} slots={[SANHUA, ENCORE, null]} />)
    expect(screen.getByText("IN")).toBeTruthy()
  })

  it("omits the Loop row when there is no loop rotation", () => {
    render(<ShareCard cards={cards} slots={[SANHUA, null, null]} />)
    expect(screen.queryByText("Loop")).toBeNull()
  })

  it("renders the Loop row when a loop rotation is present", () => {
    const withLoop: RotationCards = {
      opener: cards.opener,
      loop: [{ characterId: SANHUA, letters: "ERQ", hasIntro: false }],
    }
    render(<ShareCard cards={withLoop} slots={[SANHUA, null, null]} />)
    expect(screen.getByText("Loop")).toBeTruthy()
    expect(screen.getByText("ERQ")).toBeTruthy()
  })
})
