// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { LibraryPage } from "./LibraryPage"
import type { SavedTeam } from "#/hooks/useLibrary"
import { computeTeamStats } from "#/lib/team-stats"
import { emptyLoadout } from "#/lib/loadout/template"
import { encodePayload } from "#/lib/import-export"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

const LIBRARY_KEY = "wuwa.library"

function savedTeam(over: Partial<SavedTeam> = {}): SavedTeam {
  return {
    id: "t1",
    name: "Frosty",
    updated: Date.UTC(2026, 0, 1),
    pinned: false,
    payload: {
      team: {
        name: "Frosty",
        slots: [null, null, null],
        loadouts: [emptyLoadout(), emptyLoadout(), emptyLoadout()],
        focusedId: null,
      },
      timeline: null,
    },
    stats: computeTeamStats([]),
    ...over,
  }
}

function seed(teams: SavedTeam[]): void {
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(teams))
}

function readLibrary(): SavedTeam[] {
  return JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? "[]")
}

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe("LibraryPage — delete confirmation", () => {
  it("opens ConfirmModal with the team name; confirm removes the team", () => {
    seed([savedTeam()])
    render(<LibraryPage />)

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])

    expect(
      screen.getByText('Delete "Frosty"? This cannot be undone.'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))

    expect(readLibrary()).toEqual([])
  })

  it("cancel dismisses the modal without removing the team", () => {
    seed([savedTeam()])
    render(<LibraryPage />)

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(
      screen.queryByText('Delete "Frosty"? This cannot be undone.'),
    ).toBeNull()
    expect(readLibrary()).toHaveLength(1)
  })
})

describe("LibraryPage — import modal", () => {
  function openImport() {
    fireEvent.click(screen.getByRole("button", { name: "import" }))
  }

  it("header import button opens the ImportModal (no window.prompt)", () => {
    const promptSpy = vi.spyOn(window, "prompt")
    render(<LibraryPage />)
    openImport()
    expect(screen.getByPlaceholderText("Paste build code here…")).toBeTruthy()
    expect(promptSpy).not.toHaveBeenCalled()
    promptSpy.mockRestore()
  })

  it("a bad code shows an inline error instead of importing", () => {
    render(<LibraryPage />)
    openImport()
    fireEvent.change(screen.getByPlaceholderText("Paste build code here…"), {
      target: { value: "not-a-real-code" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(screen.getByText("That export code could not be read.")).toBeTruthy()
    expect(readLibrary()).toEqual([])
  })

  it("editing the textarea clears a stale error", () => {
    render(<LibraryPage />)
    openImport()
    const textarea = screen.getByPlaceholderText("Paste build code here…")
    fireEvent.change(textarea, { target: { value: "not-a-real-code" } })
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(screen.getByText("That export code could not be read.")).toBeTruthy()
    fireEvent.change(textarea, { target: { value: "still typing" } })
    expect(screen.queryByText("That export code could not be read.")).toBeNull()
  })

  it("a good code imports the team and closes the modal", () => {
    const code = encodePayload(savedTeam({ name: "Imported" }).payload)
    render(<LibraryPage />)
    openImport()
    fireEvent.change(screen.getByPlaceholderText("Paste build code here…"), {
      target: { value: code },
    })
    fireEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(screen.queryByPlaceholderText("Paste build code here…")).toBeNull()
    expect(readLibrary()).toHaveLength(1)
  })
})
