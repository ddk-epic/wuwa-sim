// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { getDefaultStore } from "jotai"
import { TableTopBar } from "./TableTopBar"
import { renamingGroupIdAtom } from "#/state/renaming"

afterEach(cleanup)

describe("TableTopBar — add group", () => {
  it("writes the newly-added group id to renamingGroupIdAtom", () => {
    const store = getDefaultStore()
    store.set(renamingGroupIdAtom, null)
    render(
      <TableTopBar
        entriesNumber={0}
        totalDmg={0}
        dps={0}
        totalTimeSec={0}
        hasLoopMarker={false}
        onAddGroup={() => "new-group-id"}
        onAddLoopMarker={() => {}}
      />,
    )
    fireEvent.click(screen.getByText("+ Group"))
    expect(store.get(renamingGroupIdAtom)).toBe("new-group-id")
  })
})

describe("TableTopBar — add loop marker", () => {
  it("calls onAddLoopMarker and is enabled when no marker exists", () => {
    let added = false
    render(
      <TableTopBar
        entriesNumber={0}
        totalDmg={0}
        dps={0}
        totalTimeSec={0}
        hasLoopMarker={false}
        onAddGroup={() => "g"}
        onAddLoopMarker={() => {
          added = true
        }}
      />,
    )
    const button = screen.getByText("+ Loop")
    expect(button.hasAttribute("disabled")).toBe(false)
    fireEvent.click(button)
    expect(added).toBe(true)
  })

  it("disables the button once a marker is present", () => {
    render(
      <TableTopBar
        entriesNumber={0}
        totalDmg={0}
        dps={0}
        totalTimeSec={0}
        hasLoopMarker={true}
        onAddGroup={() => "g"}
        onAddLoopMarker={() => {}}
      />,
    )
    expect(screen.getByText("+ Loop").hasAttribute("disabled")).toBe(true)
  })
})
