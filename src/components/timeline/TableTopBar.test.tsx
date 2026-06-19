// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { getDefaultStore } from "jotai"
import { TableTopBar } from "./TableTopBar"
import { renamingGroupIdAtom } from "#/state/renaming"

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
        onAddGroup={() => "new-group-id"}
      />,
    )
    fireEvent.click(screen.getByText("+ Group"))
    expect(store.get(renamingGroupIdAtom)).toBe("new-group-id")
  })
})
