// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { HexPill } from "./HexPill"

describe("HexPill", () => {
  it("renders the label", () => {
    render(<HexPill hex="#abcdef">group</HexPill>)
    expect(screen.getByText("group")).toBeTruthy()
  })

  it("tints background, border, and text from the hex accent", () => {
    render(<HexPill hex="#abcdef">x</HexPill>)
    const pill = screen.getByText("x")
    // jsdom normalizes 8-digit hex (#rrggbbaa) to rgba(); assert on the channels.
    expect(pill.style.background).toBe("rgba(171, 205, 239, 0.082)")
    expect(pill.style.border).toBe("1px solid rgba(171, 205, 239, 0.2)")
    expect(pill.style.color).toBe("rgb(171, 205, 239)")
  })

  it("uses the shared pill skeleton classes", () => {
    render(<HexPill hex="#888">y</HexPill>)
    const pill = screen.getByText("y")
    expect(pill.className).toContain("inline-block")
    expect(pill.className).toContain("uppercase")
    expect(pill.className).toContain("font-mono")
  })
})
