// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { CreateTeamModal } from "./CreateTeamModal"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
})

afterEach(cleanup)

function readLiveTeam() {
  return JSON.parse(localStorage.getItem("wuwa.team")!)
}

describe("CreateTeamModal — Move to sim commit", () => {
  it("commits the resolved suggestion when the name is left empty", () => {
    render(<CreateTeamModal onClose={() => {}} />)
    // No name typed and no character selected → the 'New team' fallback.
    fireEvent.click(screen.getByRole("button", { name: "Move to sim" }))
    expect(readLiveTeam().name).toBe("New team")
  })

  it("commits a name typed into the auto-opened rename field on blur", () => {
    render(<CreateTeamModal onClose={() => {}} />)
    // autoEdit opens the InlineRename field ready to type; the value commits
    // via onCommit (blur) before "Move to sim" reads it.
    const input = screen.getByRole("textbox", { name: "Team name" })
    fireEvent.change(input, { target: { value: "Glacio Burst" } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole("button", { name: "Move to sim" }))
    expect(readLiveTeam().name).toBe("Glacio Burst")
  })
})
