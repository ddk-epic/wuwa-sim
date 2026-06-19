// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"
import { Provider, createStore } from "jotai"
import { teamAtom, nameAtom, draftActiveTeam, useTeamPersistence } from "./team"

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
