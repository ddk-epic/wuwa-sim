// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { EchoMainsToggle } from "./EchoMainsToggle"

const options = [
  { value: "scaling", label: "ATK%" },
  { value: "cr", label: "CR" },
  { value: "cd", label: "CD" },
]

afterEach(cleanup)

describe("EchoMainsToggle — FIFO ring-buffer", () => {
  it("queue grows from empty: click cd → ['cd']", () => {
    const onChange = vi.fn()
    render(
      <EchoMainsToggle
        options={options}
        mains={[]}
        capacity={2}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText("CD"))
    expect(onChange).toHaveBeenCalledWith(["cd"])
  })

  it("does not exceed capacity: at cap click evicts oldest", () => {
    const onChange = vi.fn()
    render(
      <EchoMainsToggle
        options={options}
        mains={["cr", "cd"]}
        capacity={2}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText("ATK%"))
    expect(onChange).toHaveBeenCalledWith(["cd", "scaling"])
  })

  it("allows clicking same option twice: ['cd', 'cd'] at cap 2", () => {
    const onChange = vi.fn()
    render(
      <EchoMainsToggle
        options={options}
        mains={["cd"]}
        capacity={2}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText("CD"))
    expect(onChange).toHaveBeenCalledWith(["cd", "cd"])
  })

  it("evicts oldest in mixed sequence: ['cd', 'cd'] → click cr → ['cd', 'cr']", () => {
    const onChange = vi.fn()
    render(
      <EchoMainsToggle
        options={options}
        mains={["cd", "cd"]}
        capacity={2}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText("CR"))
    expect(onChange).toHaveBeenCalledWith(["cd", "cr"])
  })

  it("capacity 1: any click replaces the single slot", () => {
    const onChange = vi.fn()
    render(
      <EchoMainsToggle
        options={options}
        mains={["cd"]}
        capacity={1}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText("CR"))
    expect(onChange).toHaveBeenCalledWith(["cr"])
  })

  it("shows ×N badge when count > 1", () => {
    render(
      <EchoMainsToggle
        options={options}
        mains={["cd", "cd"]}
        capacity={2}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByText("×2")).not.toBeNull()
  })

  it("no badge when count is 1 or 0", () => {
    render(
      <EchoMainsToggle
        options={options}
        mains={["cr", "cd"]}
        capacity={2}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByText("×1")).toBeNull()
    expect(screen.queryByText("×0")).toBeNull()
  })
})
