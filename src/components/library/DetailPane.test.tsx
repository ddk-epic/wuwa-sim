// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { DetailCard } from "./DetailPane"
import type { LibTeam, RowActions } from "./types"

function libTeam(over: Partial<LibTeam> = {}): LibTeam {
  return {
    id: "t1",
    name: "Frosty",
    updated: "2026-01-01",
    pinned: false,
    members: [{ name: "Sanhua", element: "Glacio", seq: 0, weapon: "Sword" }],
    actions: 3,
    totalTime: 12.3,
    totalDmg: 1000,
    dps: 80,
    concertoEnd: 0,
    resEnd: 0,
    dmgByChar: { Sanhua: 1000 },
    typeMix: {},
    ...over,
  }
}

function spyActions(): RowActions {
  return {
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onTogglePin: vi.fn(),
    onDuplicate: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
  }
}

function renderCard(actions: RowActions) {
  return render(
    <DetailCard
      team={libTeam()}
      isEmpty={false}
      actions={actions}
      onCreate={() => {}}
      onImport={() => {}}
    />,
  )
}

afterEach(cleanup)

describe("DetailHero — inline rename", () => {
  it("clicking the name turns it into an editable input", () => {
    renderCard(spyActions())
    expect(screen.queryByLabelText("Team name")).toBeNull()
    fireEvent.click(screen.getByText("Frosty"))
    expect(screen.getByLabelText("Team name")).toBeTruthy()
  })

  it("Enter commits the new name via rename(id, name)", () => {
    const actions = spyActions()
    renderCard(actions)
    fireEvent.click(screen.getByText("Frosty"))
    const input = screen.getByLabelText("Team name")
    fireEvent.change(input, { target: { value: "Glacial" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(actions.onRename).toHaveBeenCalledWith("t1", "Glacial")
    // reverts to display
    expect(screen.queryByLabelText("Team name")).toBeNull()
  })

  it("blur commits the new name", () => {
    const actions = spyActions()
    renderCard(actions)
    fireEvent.click(screen.getByText("Frosty"))
    const input = screen.getByLabelText("Team name")
    fireEvent.change(input, { target: { value: "Glacial" } })
    fireEvent.blur(input)
    expect(actions.onRename).toHaveBeenCalledWith("t1", "Glacial")
  })

  it("empty/whitespace name is rejected", () => {
    const actions = spyActions()
    renderCard(actions)
    fireEvent.click(screen.getByText("Frosty"))
    const input = screen.getByLabelText("Team name")
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(actions.onRename).not.toHaveBeenCalled()
    expect(screen.queryByLabelText("Team name")).toBeNull()
  })

  it("no Rename pencil button remains in the hero", () => {
    renderCard(spyActions())
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull()
  })
})
