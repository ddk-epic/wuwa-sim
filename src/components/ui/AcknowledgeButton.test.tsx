// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { SaveIcon } from "lucide-react"
import { AcknowledgeButton } from "./AcknowledgeButton"

function button() {
  return screen.getByRole<HTMLButtonElement>("button")
}
function iconClass() {
  return button().querySelector("svg")?.getAttribute("class") ?? ""
}

describe("AcknowledgeButton", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("flashes a green check on a sync action, then reverts and stays locked during the window", () => {
    const onClick = vi.fn()
    render(<AcknowledgeButton icon={SaveIcon} label="Save" onClick={onClick} />)

    act(() => fireEvent.click(button()))
    expect(onClick).toHaveBeenCalledOnce()
    expect(iconClass()).toContain("text-green-400")
    expect(button().disabled).toBe(true)

    act(() => vi.advanceTimersByTime(1500))
    expect(iconClass()).not.toContain("text-green-400")
    expect(button().disabled).toBe(false)
  })

  it("locks while an async action is in flight and ignores repeat clicks", async () => {
    let resolve!: () => void
    const onClick = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(<AcknowledgeButton icon={SaveIcon} label="Save" onClick={onClick} />)

    act(() => fireEvent.click(button()))
    expect(button().disabled).toBe(true)
    act(() => fireEvent.click(button()))
    expect(onClick).toHaveBeenCalledOnce()

    await act(async () => resolve())
    expect(iconClass()).toContain("text-green-400")
    act(() => vi.advanceTimersByTime(1500))
    expect(button().disabled).toBe(false)
  })

  it("flashes an amber warning with the error message on a rejected action, then re-enables for retry", async () => {
    let reject!: (e: unknown) => void
    const onClick = vi.fn(() => new Promise<void>((_, r) => (reject = r)))
    render(<AcknowledgeButton icon={SaveIcon} label="Copy" onClick={onClick} />)

    act(() => fireEvent.click(button()))
    await act(async () => reject(new Error("nope")))

    expect(iconClass()).toContain("text-amber-400")
    expect(button().getAttribute("title")).toBe("nope")
    expect(button().disabled).toBe(false)

    act(() => vi.advanceTimersByTime(3000))
    expect(iconClass()).not.toContain("text-amber-400")
  })

  it("abandons a never-settling action after maxLock and ignores its late settle", async () => {
    let resolve!: () => void
    const onClick = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(
      <AcknowledgeButton
        icon={SaveIcon}
        label="Copy"
        onClick={onClick}
        maxLock={6000}
      />,
    )

    act(() => fireEvent.click(button()))
    expect(button().disabled).toBe(true)

    act(() => vi.advanceTimersByTime(6000))
    expect(button().disabled).toBe(false)

    await act(async () => resolve())
    expect(iconClass()).not.toContain("text-green-400")
  })

  it("honors an external disabled regardless of internal state", () => {
    const onClick = vi.fn()
    render(
      <AcknowledgeButton
        icon={SaveIcon}
        label="Save"
        onClick={onClick}
        disabled
      />,
    )
    expect(button().disabled).toBe(true)
    act(() => fireEvent.click(button()))
    expect(onClick).not.toHaveBeenCalled()
  })
})
