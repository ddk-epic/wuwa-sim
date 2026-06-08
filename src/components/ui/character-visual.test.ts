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
  it("elementHex maps known elements and falls back to gray", () => {
    expect(elementHex("Glacio")).toBe("#5ad7f0")
    expect(elementHex("Nonsense")).toBe("#888")
    expect(elementHex("")).toBe("#888")
  })

  it("portraitSrc lowercases the name", () => {
    expect(portraitSrc("Verina")).toBe("/portraits/verina.png")
    expect(portraitSrc("Jinhsi")).toBe("/portraits/jinhsi.png")
  })

  it("nameInitial uppercases the first letter, '?' on empty", () => {
    expect(nameInitial("verina")).toBe("V")
    expect(nameInitial("")).toBe("?")
  })

  it("elementLetter takes the first letter, '?' on empty", () => {
    expect(elementLetter("Glacio")).toBe("G")
    expect(elementLetter("")).toBe("?")
  })
})

describe("characterVisual", () => {
  it("unknown id → full gray/'?'/empty-element bundle", () => {
    const v = characterVisual(-1)
    expect(v).toEqual({
      name: "#-1",
      element: "",
      hex: "#888",
      portraitSrc: "/portraits/#-1.png",
      initial: "?",
      letter: "?",
    })
  })

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
