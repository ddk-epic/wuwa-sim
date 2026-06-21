// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { act } from "react"
import { Provider, createStore } from "jotai"
import {
  teamAtom,
  focusCharacterAtom,
  nameAtom,
  defaultActiveTeam,
} from "#/state/team"
import * as autosave from "#/hooks/useAutosaveIndicator"
import { AutosaveIndicator } from "./AutosaveIndicator"

afterEach(cleanup)

// useAutosaveIndicator runs once per AutosaveIndicator render, so spying on it
// counts the component's renders.
let spy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  spy = vi.spyOn(autosave, "useAutosaveIndicator").mockReturnValue("idle")
})
afterEach(() => spy.mockRestore())

function renderIn(store: ReturnType<typeof createStore>) {
  render(
    <Provider store={store}>
      <AutosaveIndicator />
    </Provider>,
  )
}

describe("AutosaveIndicator", () => {
  it("does not re-render when only focusedId changes", () => {
    const store = createStore()
    store.set(teamAtom, { ...defaultActiveTeam(), focusedId: null })
    renderIn(store)
    const baseline = spy.mock.calls.length

    act(() => {
      store.set(focusCharacterAtom, 1203)
    })
    expect(spy.mock.calls.length).toBe(baseline)
  })

  it("re-renders when a watched slice (name) changes", () => {
    const store = createStore()
    renderIn(store)
    const baseline = spy.mock.calls.length

    act(() => {
      store.set(nameAtom, "Renamed")
    })
    expect(spy.mock.calls.length).toBeGreaterThan(baseline)
  })

  it("passes the { name, slots, loadouts, settings } snapshot to the hook", () => {
    const team = defaultActiveTeam()
    const store = createStore()
    store.set(teamAtom, team)
    renderIn(store)
    expect(spy).toHaveBeenCalledWith({
      name: team.name,
      slots: team.slots,
      loadouts: team.loadouts,
      settings: team.settings,
    })
  })
})
