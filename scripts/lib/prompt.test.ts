import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import { select } from "./prompt"

function harness(...lines: string[]) {
  const input = new PassThrough()
  const output = new PassThrough()
  let printed = ""
  output.on("data", (chunk: Buffer) => {
    printed += chunk.toString()
  })
  for (const line of lines) input.write(`${line}\n`)
  input.end()
  return { io: { input, output }, printed: () => printed }
}

const choices = [
  { label: "Sierra Gale", value: "gale" },
  { label: "Windward Pilgrimage", value: "wind" },
]

describe("select", () => {
  it("returns the value at the chosen position", async () => {
    const { io } = harness("2")
    expect(await select("Echo set", choices, io)).toBe("wind")
  })

  it("re-asks on an out-of-range or non-numeric line, then accepts a valid one", async () => {
    const { io, printed } = harness("9", "abc", "1")
    expect(await select("Echo set", choices, io)).toBe("gale")
    expect(printed()).toContain("Enter a number between 1 and 2.")
  })

  it("throws when there is nothing to pick", async () => {
    const { io } = harness()
    await expect(select("Echo set", [], io)).rejects.toThrow(/No choices/)
  })

  it("throws when the input closes before a valid answer", async () => {
    const { io } = harness("9")
    await expect(select("Echo set", choices, io)).rejects.toThrow(
      /Input closed/,
    )
  })
})
