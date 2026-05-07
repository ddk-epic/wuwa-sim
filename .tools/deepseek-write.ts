#!/usr/bin/env tsx
/**
 * Delegate boilerplate generation to Deepseek V4.
 *
 * Deepseek V4 is a thinking model — it uses reasoning tokens internally.
 * max-tokens must be high enough to cover both reasoning + output code.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import OpenAI from "openai"

const { values } = parseArgs({
  options: {
    spec: { type: "string" },
    context: { type: "string" },
    target: { type: "string" },
    "max-tokens": { type: "string", default: "16384" },
    model: { type: "string" },
  },
  strict: true,
  allowPositionals: false,
})

if (!values.spec) {
  process.stderr.write("--spec is required\n")
  process.exit(2)
}
if (!values.target) {
  process.stderr.write("--target is required\n")
  process.exit(2)
}

const maxTokens = Number(values["max-tokens"])
if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
  process.stderr.write(
    `--max-tokens must be a positive integer (got ${JSON.stringify(values["max-tokens"])})\n`,
  )
  process.exit(2)
}

const apiKey = process.env.WORKER_API_KEY
const baseURL = process.env.WORKER_BASE_URL
const defaultModel = process.env.WORKER_MODEL
if (!apiKey || !baseURL || !defaultModel) {
  process.stderr.write(
    "WORKER_API_KEY, WORKER_BASE_URL, WORKER_MODEL must be set\n",
  )
  process.exit(2)
}

const client = new OpenAI({ apiKey, baseURL })
const decoder = new TextDecoder("utf-8", { fatal: false })

let ctx = ""
if (values.context) {
  let buf: Buffer
  try {
    buf = readFileSync(values.context)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      process.stderr.write(`--context file not found: ${values.context}\n`)
      process.exit(2)
    }
    throw err
  }
  ctx = `<reference>\n${decoder.decode(buf)}\n</reference>\n`
}

const resp = await client.chat.completions.create({
  model: values.model ?? defaultModel,
  messages: [
    {
      role: "system",
      content:
        "Generate clean, idiomatic code matching the style of any " +
        "reference provided. No explanations, no markdown fences — " +
        "output ONLY the file contents.",
    },
    { role: "user", content: `${ctx}Write: ${values.spec}` },
  ],
  max_tokens: maxTokens,
})

const choice = resp.choices[0]
let content = choice.message.content
if (!content) {
  process.stderr.write(
    "[ERROR: Deepseek ran out of tokens during reasoning. " +
      "Try --max-tokens 32768]\n",
  )
  process.exit(1)
}

// Strip accidental markdown fences if Deepseek adds them
if (content.startsWith("```")) {
  const firstNl = content.indexOf("\n")
  if (firstNl !== -1) content = content.slice(firstNl + 1)
  const lastFence = content.lastIndexOf("```")
  if (lastFence !== -1) content = content.slice(0, lastFence)
}

try {
  writeFileSync(values.target, content)
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    process.stderr.write(
      `--target directory does not exist: ${values.target}\n`,
    )
    process.exit(2)
  }
  throw err
}

process.stdout.write(`Wrote ${values.target} (${content.length} chars)\n`)
const u = resp.usage!
const cached =
  (u as { prompt_tokens_details?: { cached_tokens?: number } })
    .prompt_tokens_details?.cached_tokens ?? 0
process.stderr.write(
  `[deepseek: ${u.prompt_tokens} in (${cached} cached) / ` +
    `${u.completion_tokens} out | finish: ${choice.finish_reason}]\n`,
)
