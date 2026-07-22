import * as readline from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

export interface Choice<T> {
  label: string
  value: T
}

export interface PromptIo {
  input: Readable
  output: Writable
}

function defaultIo(): PromptIo {
  return { input: process.stdin, output: process.stdout }
}

// Re-asks until the line parses to an in-range index. Widening ("Other") is an
// extra choice the caller appends.
export async function select<T>(
  question: string,
  choices: Choice<T>[],
  io: PromptIo = defaultIo(),
): Promise<T> {
  if (choices.length === 0) throw new Error(`No choices for "${question}"`)

  const rl = readline.createInterface({ input: io.input, output: io.output })
  try {
    io.output.write(`\n${question}\n`)
    for (const [i, choice] of choices.entries()) {
      io.output.write(`  ${i + 1}. ${choice.label}\n`)
    }
    io.output.write("> ")
    // Iterate rather than repeat rl.question: buffered/piped lines are not
    // dropped between prompts this way.
    for await (const line of rl) {
      const n = Number(line.trim())
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
        return choices[n - 1].value
      }
      io.output.write(`Enter a number between 1 and ${choices.length}.\n> `)
    }
    throw new Error(`Input closed before "${question}" was answered`)
  } finally {
    rl.close()
  }
}
