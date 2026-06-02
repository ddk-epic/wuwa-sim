// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LibraryList } from "./LibraryList"
import type { LibTeam, RowActions } from "./types"

function libTeam(over: Partial<LibTeam> = {}): LibTeam {
  return {
    id: "t1",
    name: "Frosty",
    updated: "just now",
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

describe("LibraryList — row selection", () => {
  it("clicking a row only selects it (no launch / no onOpen)", () => {
    const onSelect = vi.fn()
    const actions = spyActions()
    render(
      <LibraryList
        teams={[libTeam()]}
        selectedId={null}
        onSelect={onSelect}
        query=""
        setQuery={() => {}}
        sort="recent"
        setSort={() => {}}
        actions={actions}
        onCreate={() => {}}
      />,
    )
    // Click the row body (the name bubbles to the row's onClick).
    fireEvent.click(screen.getByText("Frosty"))
    expect(onSelect).toHaveBeenCalledWith("t1")
    // The launch path (load + navigate) must not fire from a row click.
    expect(actions.onOpen).not.toHaveBeenCalled()
  })
})
