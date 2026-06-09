import { describe, expect, it } from "vitest"
import { listCharacters } from "#/lib/loadout/catalog"
import {
  elementHex,
  portraitSrc,
  nameInitial,
  elementLetter,
  characterVisual,
} from "./character-visual"

describe("character-visual atoms", () => {
  it("elementHex maps known elements to their hex", () => {
    expect(elementHex("Glacio")).toBe("#5ad7f0")
  })

  it("portraitSrc lowercases the name", () => {
    expect(portraitSrc("Verina")).toBe("/portraits/verina.png")
    expect(portraitSrc("Jinhsi")).toBe("/portraits/jinhsi.png")
  })

  it("nameInitial uppercases the first letter", () => {
    expect(nameInitial("verina")).toBe("V")
  })

  it("elementLetter takes the first letter", () => {
    expect(elementLetter("Glacio")).toBe("G")
  })
})

describe("characterVisual", () => {
  it("known id → correct hex/name/initial/letter", () => {
    // Pick a real character from the catalog so the test is data-agnostic.
    const c = listCharacters()[0]
    expect(c).toBeDefined()
    const v = characterVisual(c.id)
    expect(v.name).toBe(c.name)
    expect(v.element).toBe(c.element)
    expect(v.hex).toBe(elementHex(c.element))
    expect(v.initial).toBe(c.name.at(0)?.toUpperCase())
    expect(v.letter).toBe(c.element.at(0))
    expect(v.portraitSrc).toBe(portraitSrc(c.name))
  })
})
