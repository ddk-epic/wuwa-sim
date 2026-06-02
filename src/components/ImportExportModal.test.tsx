// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import {
  ImportExportModal,
  ImportModal,
  ImportPanel,
} from "./ImportExportModal"

afterEach(cleanup)

describe("ImportExportModal (combined)", () => {
  it("Import button is disabled until the textarea has content, then fires onImport", () => {
    const onImport = vi.fn()
    render(
      <ImportExportModal
        exportString="CODE-123"
        onImport={onImport}
        importError={null}
        onClose={() => {}}
      />,
    )
    const importBtn = screen.getByRole("button", { name: "Import" })
    expect(importBtn).toHaveProperty("disabled", true)

    fireEvent.change(screen.getByPlaceholderText("Paste build code here…"), {
      target: { value: "abc" },
    })
    expect(importBtn).toHaveProperty("disabled", false)
    fireEvent.click(importBtn)
    expect(onImport).toHaveBeenCalledWith("abc")
  })

  it("renders the export string and an inline import error", () => {
    render(
      <ImportExportModal
        exportString="CODE-123"
        onImport={() => {}}
        importError="bad code"
        onClose={() => {}}
      />,
    )
    expect(
      (screen.getByDisplayValue("CODE-123") as HTMLTextAreaElement).readOnly,
    ).toBe(true)
    expect(screen.getByText("bad code")).toBeTruthy()
  })
})

describe("ImportModal (Library, import-only)", () => {
  it("renders the import panel without an Export section", () => {
    render(
      <ImportModal onImport={() => {}} importError={null} onClose={() => {}} />,
    )
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy()
    expect(screen.queryByText("Export")).toBeNull()
  })
})

describe("ImportPanel", () => {
  it("fires onChange as the textarea is edited", () => {
    const onChange = vi.fn()
    render(
      <ImportPanel
        onImport={() => {}}
        importError={null}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText("Paste build code here…"), {
      target: { value: "x" },
    })
    expect(onChange).toHaveBeenCalled()
  })
})
