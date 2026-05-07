#!/usr/bin/env tsx
/**
 * Delegate bulk reading to Deepseek V4. Returns a summary to Claude.
 *
 * Deepseek V4 is a thinking model — it uses reasoning tokens internally.
 * max-tokens must be high enough to cover both reasoning + answer.
 *
 * example: .tools/ask-deepseek --paths .tools/package.json --question  "what deps does this declare?"
 */
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"
import OpenAI from "openai"

const { values, positionals } = parseArgs({
  options: {
    paths: { type: "string", multiple: true },
    question: { type: "string" },
    "max-tokens": { type: "string", default: "8192" },
    model: { type: "string" },
  },
  strict: true,
  allowPositionals: true,
})

const paths = [...(values.paths ?? []), ...positionals]
if (paths.length === 0) {
  process.stderr.write("--paths is required\n")
  process.exit(2)
}
if (!values.question) {
  process.stderr.write("--question is required\n")
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

const docs: string[] = []
const missing: string[] = []
for (const path of paths) {
  try {
    const content = readFileSync(path, "utf-8")
    docs.push(`<file path='${path}'>\n${content}\n</file>`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      missing.push(path)
    } else {
      throw err
    }
  }
}
if (missing.length > 0) {
  process.stderr.write(`file(s) not found: ${missing.join(", ")}\n`)
  process.exit(2)
}
const corpus = docs.join("\n\n")

const resp = await client.chat.completions.create({
  model: values.model ?? defaultModel,
  messages: [
    {
      role: "system",
      content:
        "You are a precise code/document analyst. Read the provided files " +
        "and answer the question concisely. Quote file paths and line " +
        "numbers when relevant. Output structured bullets, not prose. " +
        "Keep your answer under 800 words.",
    },
    { role: "user", content: `<corpus>\n${corpus}\n</corpus>` },
    { role: "user", content: values.question },
  ],
  max_tokens: maxTokens,
})

const choice = resp.choices[0]
const answer = choice.message.content
if (answer) {
  process.stdout.write(answer + "\n")
} else if (choice.finish_reason === "length") {
  process.stderr.write(
    "[ERROR: Deepseek ran out of tokens during reasoning. " +
      "Try --max-tokens 16384]\n",
  )
  process.exit(1)
} else {
  process.stderr.write(
    `[ERROR: empty response (finish_reason=${choice.finish_reason})]\n`,
  )
  process.exit(1)
}

const u = resp.usage!
const cached =
  (u as { prompt_tokens_details?: { cached_tokens?: number } })
    .prompt_tokens_details?.cached_tokens ?? 0
process.stderr.write(
  `\n[deepseek: ${u.prompt_tokens} in (${cached} cached) / ` +
    `${u.completion_tokens} out | finish: ${choice.finish_reason}]\n`,
)
