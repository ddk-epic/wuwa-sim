#!/usr/bin/env tsx
/**
 * Extract human-readable chat from Claude Code JSONL transcripts.
 *
 * Usage:
 *   extract-chat <session.jsonl>                          # print to stdout
 *   extract-chat <session.jsonl> -o chat.txt              # write to file
 *   extract-chat <session.jsonl> | ask-deepseek...        # pipe to deepseek
 *
 * Extracts only user and assistant TEXT messages. Strips:
 *   - Tool calls, tool results, system prompts
 *   - Thinking blocks, signatures, binary data
 *   - Hooks, permissions, file snapshots, queue ops
 */
import { readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"

const { values, positionals } = parseArgs({
  options: {
    output: { type: "string", short: "o" },
  },
  allowPositionals: true,
  strict: true,
})

if (positionals.length < 1) {
  process.stderr.write("usage: extract-chat <session.jsonl> [-o output]\n")
  process.exit(2)
}

const jsonlPath = positionals[0]
const decoder = new TextDecoder("utf-8", { fatal: false })

function extract(path: string): string {
  const raw = decoder.decode(readFileSync(path))
  const messages: string[] = []
  for (const line of raw.split("\n")) {
    if (!line) continue
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof msg !== "object" || msg === null) continue
    const m = msg as Record<string, unknown>

    const msgType = m.type
    if (msgType !== "user" && msgType !== "assistant") continue

    const inner =
      typeof m.message === "object" && m.message !== null
        ? (m.message as Record<string, unknown>)
        : {}
    const role =
      typeof inner.role === "string" ? inner.role : (msgType as string)
    const content = inner.content ?? ""
    const timestamp = typeof m.timestamp === "string" ? m.timestamp : ""

    const texts: string[] = []
    if (typeof content === "string") {
      const t = content.trim()
      if (t) texts.push(t)
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block !== "object" || block === null) continue
        const b = block as Record<string, unknown>
        if (b.type === "text" && typeof b.text === "string") {
          const t = b.text.trim()
          if (t) texts.push(t)
        }
      }
    }

    if (texts.length > 0) {
      const tsTag = timestamp ? ` (${timestamp})` : ""
      const combined = texts.join("\n")
      messages.push(`[${role.toUpperCase()}]${tsTag}:\n${combined}`)
    }
  }
  return messages.join("\n\n---\n\n")
}

const result = extract(jsonlPath)

if (values.output) {
  writeFileSync(values.output, result)
  const chars = result.length
  const lines = (result.match(/\n/g)?.length ?? 0) + 1
  process.stderr.write(
    `Wrote ${lines} lines (${chars} chars) to ${values.output}\n`,
  )
} else {
  process.stdout.write(result + "\n")
}
