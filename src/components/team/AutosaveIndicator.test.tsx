// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { Provider, createStore } from "jotai"
import { teamAtom, defaultActiveTeam } from "#/state/team"
import * as autosave from "#/hooks/useAutosaveIndicator"
import { AutosaveIndicator } from "./AutosaveIndicator"

afterEach(cleanup)

let spy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  spy = vi.spyOn(autosave, "useAutosaveIndicator").mockReturnValue("idle")
})
afterEach(() => spy.mockRestore())

describe("AutosaveIndicator", () => {
  it("passes the { name, slots, loadouts, settings } snapshot to the hook", () => {
    const team = defaultActiveTeam()
    const store = createStore()
    store.set(teamAtom, team)
    render(
      <Provider store={store}>
        <AutosaveIndicator />
      </Provider>,
    )
    expect(spy).toHaveBeenCalledWith({
      name: team.name,
      slots: team.slots,
      loadouts: team.loadouts,
      settings: team.settings,
    })
  })
})
