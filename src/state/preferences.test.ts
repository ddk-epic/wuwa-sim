// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createStore } from "jotai"

// The atoms read storage at module-eval time (getOnInit), mirroring page load
// where localStorage is already populated. Each rehydration case therefore
// seeds storage and re-imports the module fresh.
async function loadAtoms() {
  vi.resetModules()
  return import("./preferences")
}

beforeEach(() => {
  localStorage.clear()
})

describe("preferencesAtom", () => {
  it("defaults to { autoRun: true, defaultLogVariant: table } when storage is empty", async () => {
    const { preferencesAtom } = await loadAtoms()
    expect(createStore().get(preferencesAtom)).toEqual({
      autoRun: true,
      defaultLogVariant: "table",
    })
  })

  it("rehydrates autoRun: false from localStorage", async () => {
    localStorage.setItem("wuwa.preferences", JSON.stringify({ autoRun: false }))
    const { autoRunAtom } = await loadAtoms()
    expect(createStore().get(autoRunAtom)).toBe(false)
  })

  it("rehydrates defaultLogVariant: timeline from localStorage", async () => {
    localStorage.setItem(
      "wuwa.preferences",
      JSON.stringify({ defaultLogVariant: "timeline" }),
    )
    const { defaultLogVariantAtom } = await loadAtoms()
    expect(createStore().get(defaultLogVariantAtom)).toBe("timeline")
  })

  it("falls back to defaults for a non-object stored value", async () => {
    localStorage.setItem("wuwa.preferences", "not-json-object")
    const { preferencesAtom } = await loadAtoms()
    expect(createStore().get(preferencesAtom)).toEqual({
      autoRun: true,
      defaultLogVariant: "table",
    })
  })

  it("falls back to table for an invalid defaultLogVariant", async () => {
    localStorage.setItem(
      "wuwa.preferences",
      JSON.stringify({ defaultLogVariant: "nonsense" }),
    )
    const { defaultLogVariantAtom } = await loadAtoms()
    expect(createStore().get(defaultLogVariantAtom)).toBe("table")
  })

  it("writing autoRunAtom updates the field and persists the full object", async () => {
    const { autoRunAtom } = await loadAtoms()
    const store = createStore()
    store.set(autoRunAtom, false)
    expect(store.get(autoRunAtom)).toBe(false)
    expect(JSON.parse(localStorage.getItem("wuwa.preferences")!)).toEqual({
      autoRun: false,
      defaultLogVariant: "table",
    })
  })

  it("writing defaultLogVariantAtom leaves autoRun untouched", async () => {
    const { preferencesAtom, defaultLogVariantAtom } = await loadAtoms()
    const store = createStore()
    store.set(defaultLogVariantAtom, "timeline")
    expect(store.get(preferencesAtom)).toEqual({
      autoRun: true,
      defaultLogVariant: "timeline",
    })
  })
})
