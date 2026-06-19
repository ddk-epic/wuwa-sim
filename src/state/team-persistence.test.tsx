// @vitest-environment jsdom
import { StrictMode } from "react"
import { describe, expect, it, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"
import { Provider, createStore } from "jotai"
import {
  teamAtom,
  nameAtom,
  draftActiveTeam,
  useTeamPersistence,
  coerceStoredActiveTeam,
} from "./team"

beforeEach(() => {
  localStorage.clear()
})

function Bridge() {
  useTeamPersistence()
  return null
}

describe("useTeamPersistence — live root", () => {
  it("hydrates the team from wuwa.team on mount, coercing a partial object", () => {
    localStorage.setItem(
      "wuwa.team",
      JSON.stringify({ name: "Stored", slots: [1203, null, null] }),
    )
    const store = createStore()
    render(
      <Provider store={store}>
        <Bridge />
      </Provider>,
    )
    expect(store.get(teamAtom).name).toBe("Stored")
    // A field absent from the partial object falls back to defaults.
    expect(store.get(teamAtom).originId).toBeNull()
  })

  it("hydrates the stored team even when the atom already holds a stale one, under StrictMode", () => {
    // The app-wide store survives navigation, so teamAtom can still hold a team
    // from a prior route when /sim remounts and the bridge re-runs.
    const store = createStore()
    store.set(
      teamAtom,
      coerceStoredActiveTeam({ name: "Stale", slots: [9999, null, null] }),
    )
    // The freshly committed team (e.g. the Library "Move to sim" draft).
    localStorage.setItem(
      "wuwa.team",
      JSON.stringify({
        name: "Drafted",
        slots: [1102, 1203, null],
        originId: null,
      }),
    )
    act(() => {
      render(
        <StrictMode>
          <Provider store={store}>
            <Bridge />
          </Provider>
        </StrictMode>,
      )
    })
    expect(store.get(teamAtom).name).toBe("Drafted")
    expect(JSON.parse(localStorage.getItem("wuwa.team")!).name).toBe("Drafted")
  })

  it("persists team changes back to wuwa.team", () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <Bridge />
      </Provider>,
    )
    act(() => {
      store.set(nameAtom, "Edited")
    })
    expect(JSON.parse(localStorage.getItem("wuwa.team")!).name).toBe("Edited")
  })
})

describe("draft isolation — a store without the bridge", () => {
  it("never writes wuwa.team when the draft is edited", () => {
    const draftStore = createStore()
    draftStore.set(teamAtom, draftActiveTeam())
    render(<Provider store={draftStore}>{null}</Provider>)
    act(() => {
      draftStore.set(nameAtom, "Throwaway")
      draftStore.set(teamAtom, (t) => ({ ...t, slots: [1102, null, null] }))
    })
    expect(localStorage.getItem("wuwa.team")).toBeNull()
  })
})
